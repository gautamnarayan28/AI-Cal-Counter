"""Offline hybrid retrieval. Never estimates quantity or alters nutrition values."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import unicodedata
import numpy as np
from fastembed import TextEmbedding

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/nutrition"
MODEL = "BAAI/bge-small-en-v1.5"
VERSION = 2
# Curated search descriptions are NOT ingredient lists or source nutrition facts.
ANNOTATIONS = {
 "ASC146": {"aliases":["potato masala dosa", "aloo dosa"], "description":"crispy rice and lentil pancake with potato filling", "tags":["dosa","potato"]},
 "BFP148": {"aliases":["plain dosai", "plain dosa"], "description":"plain rice and lentil crepe without filling", "tags":["dosa","plain"]},
 "BFP151": {"aliases":["paneer dosa", "cottage cheese dosa"], "description":"rice and lentil pancake with paneer filling", "tags":["dosa","paneer"]},
 "BFP150": {"aliases":["mixed vegetable dosa"], "description":"dosa with mixed vegetable filling", "tags":["dosa","vegetable"]},
 "ASC144": {"aliases":["idly"], "description":"steamed rice and lentil cakes", "tags":["idli"]},
 "ASC096": {"aliases":["chapati", "roti", "phulka"], "description":"whole wheat flatbread", "tags":["roti"]},
 "ASC165": {"aliases":["rajma", "rajma curry"], "description":"kidney beans in curry", "tags":["rajma"]},
 "BFP044": {"aliases":["poha", "kanda poha"], "description":"flattened rice breakfast", "tags":["poha"]},
 "ASC167": {"aliases":["sambhar"], "description":"South Indian lentil and vegetable stew", "tags":["sambar"]},
}
ALIASES = {"dosai":"dosa", "dosas":"dosa", "rotis":"roti", "chapatis":"chapati", "idly":"idli", "idlis":"idli", "parantha":"paratha", "parathas":"paratha", "paranthas":"paratha", "aaloo":"potato", "aloo":"potato", "alu":"potato", "batata":"potato", "rajmah":"rajma", "sambhar":"sambar"}
QUALIFIERS = {"paneer", "potato", "plain", "rava", "semolina", "jowar", "moong", "chicken", "mutton", "egg", "fish", "cheese", "onion", "butter", "ghee"}
FAMILIES = {"dosa", "idli", "paratha", "roti", "poha", "sambar", "rajma"}

def normalize(text):
    text = unicodedata.normalize("NFKC", text).lower().replace("cottage cheese", "paneer")
    words = re.findall(r"[^\W_]+", text, re.UNICODE)
    return " ".join(ALIASES.get(w,w) for w in words)

def query_details(text):
    normalized = normalize(text)
    excluded = set()
    # Conservative scope: only explicit negation near a recognized qualifier.
    for m in re.finditer(r"\b(?:no|without|not|hold|excluding)\s+(?:any\s+|the\s+)?([a-z]+)(?:\s+(?:or|and)\s+([a-z]+))?", normalized):
        excluded.update(t for t in m.groups() if t in QUALIFIERS)
    tokens = set(normalized.split())
    required = (tokens & QUALIFIERS) - excluded
    if "plain" in required:
        excluded |= {"paneer", "potato"}
    return normalized, required, excluded, tokens & FAMILIES

def model(cache):
    return TextEmbedding(model_name=MODEL, cache_dir=str(cache), threads=2)

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def config_digest():
    return hashlib.sha256(json.dumps([ANNOTATIONS,ALIASES,sorted(QUALIFIERS),sorted(FAMILIES)],sort_keys=True).encode()).hexdigest()

def build(source, target, cache):
    src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    rows = [dict(r) for r in src.execute("SELECT food_code, food_name, primarysource, energy_kcal, unit_serving_energy_kcal, servings_unit, serving_usable, source_row FROM nutrition_foods ORDER BY food_code")]
    src.close()
    docs = []
    for r in rows:
        a = ANNOTATIONS.get(r["food_code"], {})
        r["aliases"] = a.get("aliases", [])
        r["search_description"] = a.get("description", "")
        r["tags"] = sorted((set(normalize(r["food_name"]).split()) & (QUALIFIERS|FAMILIES)) | set(a.get("tags",[])))
        r["normalized_name"] = normalize(r["food_name"])
        r["document"] = ". ".join([r["food_name"], *r["aliases"], r["search_description"]]).strip(". ")
        docs.append(r["document"])
    encoder = model(cache)
    vectors = np.asarray(list(encoder.embed(docs)), dtype="<f4")
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    if not np.isfinite(vectors).all(): raise ValueError("Invalid embeddings")
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=target.parent,suffix=".sqlite"); os.close(fd)
    try:
        db = sqlite3.connect(tmp)
        db.executescript("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE search_foods (food_code TEXT PRIMARY KEY, normalized_name TEXT NOT NULL, record_json TEXT NOT NULL, embedding BLOB NOT NULL); CREATE INDEX idx_search_foods_name ON search_foods(normalized_name); CREATE VIRTUAL TABLE food_fts USING fts5(food_code UNINDEXED, words);")
        for r,v in zip(rows,vectors):
            db.execute("INSERT INTO search_foods VALUES (?,?,?,?)", (r["food_code"],r["normalized_name"],json.dumps(r),v.tobytes()))
            db.execute("INSERT INTO food_fts VALUES (?,?)", (r["food_code"],normalize(r["document"])))
        meta = {"model":MODEL,"dimensions":vectors.shape[1],"source_sha256":digest(source),"config_sha256":config_digest(),"version":VERSION,"record_count":len(rows)}
        db.executemany("INSERT INTO metadata VALUES (?,?)", [(k,json.dumps(v)) for k,v in meta.items()])
        db.commit()
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        db.close(); os.replace(tmp,target)
        return meta
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

class Search:
    def __init__(self, source, index, cache):
        self.db = sqlite3.connect(f"file:{index}?mode=ro",uri=True)
        self.meta = {k:json.loads(v) for k,v in self.db.execute("SELECT key,value FROM metadata")}
        if self.meta["model"] != MODEL or self.meta["version"] != VERSION or self.meta["config_sha256"] != config_digest() or self.meta["source_sha256"] != digest(source):
            raise ValueError("Search index is stale; rebuild it")
        raw = list(self.db.execute("SELECT record_json,embedding FROM search_foods ORDER BY food_code"))
        self.records = [json.loads(r) for r,_ in raw]
        self.vectors = np.stack([np.frombuffer(v,dtype="<f4") for _,v in raw])
        if self.vectors.shape != (self.meta["record_count"],self.meta["dimensions"]): raise ValueError("Invalid index dimensions")
        self.encoder = model(cache)

    def search(self, query, limit=5, mode="hybrid"):
        if not isinstance(query,str) or not query.strip() or len(query)>500: raise ValueError("Enter a food description of 1–500 characters")
        normalized, required, excluded, families = query_details(query)
        if not any(c.isalpha() for c in normalized):
            return {"query":query,"status":"no_match","results":[],"notes":["No food name provided."]}
        vector = np.asarray(next(self.encoder.query_embed(normalized)),dtype=np.float32)
        vector /= np.linalg.norm(vector)
        semantic = self.vectors @ vector
        words = sorted(set(normalized.split()))
        fts_query = " OR ".join('"'+w+'"' for w in words if w.isalpha())
        lexical = [] if not fts_query else list(self.db.execute("SELECT food_code FROM food_fts WHERE food_fts MATCH ? ORDER BY bm25(food_fts) LIMIT 40", (fts_query,)))
        lexrank = {code:rank+1 for rank,(code,) in enumerate(lexical)}
        semorder = np.argsort(-semantic)[:40]
        semrank = {self.records[i]["food_code"]:rank+1 for rank,i in enumerate(semorder)}
        candidates=[]
        for i,r in enumerate(self.records):
            code=r["food_code"]
            names=[r["normalized_name"],*[normalize(a) for a in r["aliases"]]]
            exact=normalized in names
            phrase_match=any(" "+n+" " in " "+normalized+" " for n in names)
            tags=set(r["tags"])
            # Requiring a named qualifier means an unlabelled alternative cannot silently win.
            if required-tags or excluded & tags or families-tags: continue
            if mode=="lexical" and code not in lexrank: continue
            if mode=="semantic" and code not in semrank: continue
            if mode=="hybrid" and code not in lexrank and code not in semrank and not exact: continue
            score=(1/(60+lexrank[code]) if code in lexrank and mode!="semantic" else 0)+(1/(60+semrank[code]) if code in semrank and mode!="lexical" else 0)
            if exact and mode!="semantic": score+=1
            elif phrase_match and mode!="semantic": score+=0.08
            candidates.append({"food_code":code,"food_name":r["food_name"],"score":round(score,6),"semantic_similarity":round(float(semantic[i]),4),"exact_match":exact,"name_in_description":phrase_match,"lexical_rank":lexrank.get(code),"semantic_rank":semrank.get(code),"reference":{"kcal_per_100g":r["energy_kcal"],"kcal_per_serving":r["unit_serving_energy_kcal"],"serving_unit":r["servings_unit"],"serving_usable":bool(r["serving_usable"]),"primarysource":r["primarysource"],"source_row":r["source_row"]}})
        candidates.sort(key=lambda r:(-r["score"],-r["semantic_similarity"],r["food_code"]))
        notes=[]
        if excluded: notes.append("Exclusions checked against names and curated search tags only; full ingredient absence is not verified.")
        if len(families)>1: notes.append("Search expects one food at a time; split mixed meals before retrieval.")
        if candidates and not candidates[0]["exact_match"]: notes.append("Suggested reference match; confirm the food variant and portion.")
        if candidates and not candidates[0]["reference"]["serving_usable"]: notes.append("Serving definition is incomplete; a count-based estimate is unavailable.")
        # Similarity is not calibrated confidence; non-exact results always require review.
        return {"query":query,"status":"exact_match" if candidates and candidates[0]["exact_match"] else "needs_review" if candidates else "no_match", "results":candidates[:max(1,min(limit,20))],"notes":notes}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("command",choices=["build","search"])
    parser.add_argument("query",nargs="?")
    parser.add_argument("--source",type=Path,default=DATA/"indb-2024.sqlite")
    parser.add_argument("--index",type=Path,default=DATA/"indb-search.sqlite")
    parser.add_argument("--cache",type=Path,default=Path(os.environ.get("INDB_MODEL_CACHE",str(Path.home()/".cache/indb-models"))))
    args=parser.parse_args()
    result=build(args.source,args.index,args.cache) if args.command=="build" else Search(args.source,args.index,args.cache).search(args.query)
    print(json.dumps(result,indent=2))
if __name__=="__main__": main()
