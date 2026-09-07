# INDB 2024 reference data

This is the validated, offline staging database for the calorie app. It is not connected to estimation or the hosted meal database. Hybrid search has since been added as a separate offline index; see SEARCH.md. Quantity interpretation and estimator integration remain later steps.

## Files

- `indb-2024.sqlite`: SQLite reference table, suitable for querying locally and a future controlled import into D1.
- `validation.json`: source SHA-256, original headers, source sheet, counts, and every flagged food code and row.
- `../../scripts/import_indb.py`: reproducible import using Python and openpyxl. Run with the source workbook path; `--output` can select a separate verification directory.

## Tables and units

`nutrition_foods` preserves all 82 original columns, all nutrient precision, original food codes, recipe names, source labels, and blank/null values. Food codes are primary keys. Numeric nutrients use SQLite REAL, not rounded integers. Original nutrient suffixes retain units (g, mg, ug, kcal, kJ).

Unprefixed nutrient columns are per 100 g according to the INDB methodology. `unit_serving_` values are per reference serving, identified by `servings_unit`. Never treat `energy_kcal` as calories per piece. No mass, universal bowl size, ingredient breakdown, alias, or serving conversion has been invented. The workbook does not provide an explicit serving-weight column. Matching a recipe does not establish the actual portion weight or preparation.

`nutrition_metadata` records the source identity and conventions. `source_row` links each record to its original Excel row.

Flags:

- `missing_serving_calories`: per-serving energy is null.
- `missing_serving_unit`: serving label is absent or blank.
- `serving_usable`: both fields are present. This means usable as a database reference, not verified as the user's actual serving.

## Validation results

1,014 unique food codes; all 82 source columns reconciled cell by cell after insertion. SQLite integrity check passed. No negative or non-finite nutrients accepted. Formula cells and duplicate identifiers cause the import to fail.

82 records lack serving calories. 97 lack a serving label; this includes the 82 records above plus 15 with calories but no serving label. 917 have usable reference servings. All records have per-100 g calories; missing serving data is never substituted with zero.

Spot check: ASC146, Masala dosa, source row 133: 164.5846710205078 kcal per 100 g and 345.0764465332031 kcal per dosa serving. These two bases remain separate.

Methodology: https://www.anuvaad.org.in/methodology/
Dataset: https://www.anuvaad.org.in/indian-nutrient-databank/

## Integration boundary

The source workbook is unchanged. No live database changes, deployment, estimator behavior changes, are part of this import. The separate search stage is documented in SEARCH.md. Before production integration, add the chosen schema through the project's generated Drizzle migration workflow and load reference records separately from schema migrations. Do not expose the SQLite asset through the public frontend or copy seed rows into a schema migration.
