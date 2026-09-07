"""Validation contract tests; no application or workbook writes."""
import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location("import_indb", Path(__file__).resolve().parents[1]/"scripts/import_indb.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
H = ["food_code", "food_name", "primarysource", "energy_kcal", "servings_unit", "unit_serving_energy_kcal"]
R = ["D1", "Masala dosa", "source", 164.5846710205078, "dosa", 345.0764465332031]
class ImportValidation(unittest.TestCase):
    def test_precision_and_basis_preserved(self):
        r = module.validate(H, [(2,R)])[0]
        self.assertEqual(r["energy_kcal"], R[3])
        self.assertEqual(r["unit_serving_energy_kcal"], R[5])
        self.assertEqual(r["serving_usable"], 1)
    def test_null_not_converted_to_zero(self):
        r = module.validate(H, [(2,R[:5]+[None])])[0]
        self.assertIsNone(r["unit_serving_energy_kcal"])
        self.assertEqual(r["missing_serving_calories"], 1)
        self.assertEqual(r["serving_usable"], 0)
    def test_blank_unit_and_zero_are_distinct(self):
        r = module.validate(H, [(2,R[:4]+["",0])])[0]
        self.assertEqual(r["missing_serving_unit"], 1)
        self.assertEqual(r["missing_serving_calories"], 0)
        self.assertEqual(r["serving_usable"], 0)
    def test_duplicates_rejected(self):
        with self.assertRaises(ValueError): module.validate(H, [(2,R),(3,R)])
    def test_bad_numbers_rejected(self):
        for v in [-1, float("nan"), float("inf"), "164", True]:
            with self.subTest(v=v), self.assertRaises(ValueError):
                module.validate(H, [(2,R[:3]+[v]+R[4:])])
if __name__ == "__main__": unittest.main()
