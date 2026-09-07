# Hybrid food retrieval

Step two is an offline search prototype over all 1,014 validated INDB foods. It does not change the app, live database, calorie estimator, portions, or stored meal history.

## Storage and ranking

`indb-search.sqlite` contains:

- `search_foods`: original food code, normalized name, reference metadata and nutrition, plus a 384-dimensional float32 embedding per food.
- `food_fts`: SQLite FTS5 keyword index over names, aliases, and curated search descriptions.
- `metadata`: source database hash, model ID, dimension, configuration hash, version and record count.

The model is `BAAI/bge-small-en-v1.5`, run locally with FastEmbed/ONNX. With only 1,014 vectors, a direct in-memory cosine scan is small and avoids a separate vector server or approximate-neighbor infrastructure. Vectors live in SQLite; no vector extension is required. Food names and descriptive search text are embedded, not calorie numbers. Search results carry original values unchanged.

Ranking combines the top 40 lexical and semantic candidates with reciprocal-rank fusion, then favors exact names and complete name phrases within descriptions. Known food-family and ingredient qualifiers constrain eligible matches. Aliases normalize common names and spelling variants such as dosai/dosa and aloo/potato.

Annotations in `scripts/nutrition_search.py` are explicitly curated search aids. They are not ingredients obtained from the Excel sheet. These can be expanded and reviewed independently of original nutrient data. Changing the annotations, model, source data, or index version requires rebuilding; stale indexes are rejected.

## Result contract

The search result includes ranked food codes/names, lexical and semantic ranks, matching evidence, reference nutrition, source row, serving availability, and review notes.

- `exact_match`: normalized name or curated alias matches the query exactly. It does not certify portion size, ingredients, or nutritional accuracy.
- `needs_review`: proposed similar food, not a verified exact variant.
- `no_match`: no eligible candidate. Do not substitute a conflicting food.

Similarity and fusion scores are ranking signals, not confidence percentages. Explicit exclusions are checked only against names and curated tags. An entry without a potato tag is not proof of a potato-free recipe. This system must not be used for allergy or ingredient-absence guarantees.

This stage searches one food at a time. A full meal must later be split into foods. Numerals are not interpreted or multiplied here: `2 masala dosas` can retrieve the masala dosa record, but quantity parsing and calorie calculation belong to step three.

## Reproduce

Create an isolated Python environment and install `scripts/nutrition-search-requirements.txt`. The first use downloads model weights; subsequent encoding runs locally. Use the same cache for indexing and querying.

```sh
python scripts/nutrition_search.py build --cache /path/to/model-cache
python scripts/nutrition_search.py search 'paneer dosa without potato' --cache /path/to/model-cache
INDB_MODEL_CACHE=/path/to/model-cache python -B tests/test_nutrition_search.py
```

The model cache and Python environment are not part of the app bundle. In the current development session they are `/tmp/calorie-embedding-model` and `/tmp/calorie-search-venv`. They can be recreated using the commands above.

## Evaluation

Eight integration tests pass, including 22 food-matching cases, explicit ingredient conflicts, negation, unchanged nutrient values, unknown variants, mixed meals, empty input, and SQL query safety. Detailed results are in `search-evaluation.json`.

Hybrid top-one results: 22/22. Lexical with the same curated descriptions and qualifier checks: 22/22. Semantic with qualifier checks: 16/22. These are small development/regression examples, several reflected in the curated annotations. They are not an independent benchmark and do not establish that hybrid search improves accuracy over the enriched lexical baseline. Broader unseen user meals should be evaluated before deciding thresholds or expanding deployment.

## Next integration steps

This Python search is not called by the current Cloudflare Worker. Before production connection, choose a compatible query-embedding runtime (hosted embedding service or separate local/server inference), preserve exactly the same embedding model and dimensions, and port or expose the ranking logic. Do not send these vectors to a different model's query encoder. Add a D1 schema/import workflow if using D1 in production; do not ship the offline SQLite file as a public asset.

Official embedding-tool documentation: https://qdrant.github.io/fastembed/
