"""Integration evaluation against the real local vector + FTS index."""
import json
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from nutrition_search import Search, DATA, ROOT, query_details

class FoodSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine=Search(DATA/"indb-2024.sqlite", DATA/"indb-search.sqlite", os.environ.get("INDB_MODEL_CACHE",str(Path.home()/".cache/indb-models")))
    def test_reference_cases(self):
        results=[]
        for case in json.loads((ROOT/"tests/nutrition-search-cases.json").read_text()):
            r=self.engine.search(case["query"])
            ids=[x["food_code"] for x in r["results"]]
            lexical=self.engine.search(case["query"],mode="lexical")
            semantic=self.engine.search(case["query"],mode="semantic")
            results.append({**case,"top1":ids[0] if ids else None,"top3_hit":case["expected"] in ids[:3],"status":r["status"],"lexical_top1":lexical["results"][0]["food_code"] if lexical["results"] else None,"semantic_top1":semantic["results"][0]["food_code"] if semantic["results"] else None})
            with self.subTest(query=case["query"]):
                self.assertTrue(ids)
                self.assertEqual(ids[0],case["expected"])
        if os.environ.get("INDB_WRITE_EVAL") == "1":
            (DATA/"search-evaluation.json").write_text(json.dumps({"scope":"22 development retrieval cases, not an independent nutrition-accuracy benchmark","cases":results},indent=2)+"\n")
    def test_explicit_incompatible_qualifiers_do_not_get_substituted(self):
        self.assertEqual(self.engine.search("paneer jowar dosa")["status"],"no_match")
    def test_exclusions(self):
        r=self.engine.search("dosa no potato or paneer")
        self.assertTrue(r["results"])
        self.assertTrue({"ASC146","BFP151"}.isdisjoint(x["food_code"] for x in r["results"]))
        self.assertTrue(any("not verified" in n for n in r["notes"]))
    def test_nutrition_not_recalculated(self):
        r=self.engine.search("masala dosa")["results"][0]["reference"]
        self.assertEqual(r["kcal_per_100g"],164.5846710205078)
        self.assertEqual(r["kcal_per_serving"],345.0764465332031)
    def test_unavailable_variant_requires_review(self):
        self.assertEqual(self.engine.search("paper masala dosa")["status"],"needs_review")
    def test_mixed_meal_not_silently_matched_as_one(self):
        self.assertEqual(self.engine.search("dosa and sambar")["status"],"no_match")
    def test_empty_and_numeric_input(self):
        with self.assertRaises(ValueError): self.engine.search("")
        self.assertEqual(self.engine.search("200")["status"],"no_match")
    def test_parameterized_query(self):
        self.engine.search("dosa '; DROP TABLE search_foods; --")
        self.assertEqual(self.engine.db.execute("SELECT count(*) FROM search_foods").fetchone()[0],1014)
if __name__=="__main__": unittest.main()
