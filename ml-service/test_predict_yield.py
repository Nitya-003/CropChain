"""
Test suite for ML Service /predict-yield numeric validation (issue #1234).
"""

import unittest
from app import app, API_KEY


class TestPredictYieldValidation(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.headers = {"X-API-Key": API_KEY}

    def test_non_numeric_area_returns_422(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={"crop": "wheat", "area_hectares": "abc"},
        )
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        self.assertEqual(body["error"], "Validation failed")
        self.assertTrue(any("area_hectares" in d for d in body["details"]))

    def test_nan_area_returns_422(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={"crop": "wheat", "area_hectares": "NaN"},
        )
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        self.assertEqual(body["error"], "Validation failed")
        self.assertTrue(any("finite" in d for d in body["details"]))

    def test_non_numeric_temperature_returns_422(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={"crop": "wheat", "area_hectares": 10, "avg_temperature": "hot"},
        )
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        self.assertTrue(any("avg_temperature" in d for d in body["details"]))

    def test_inf_rainfall_returns_422(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={"crop": "wheat", "area_hectares": 10, "expected_rainfall": "Infinity"},
        )
        self.assertEqual(res.status_code, 422)
        body = res.get_json()
        self.assertTrue(any("finite" in d for d in body["details"]))

    def test_valid_request_still_succeeds(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={
                "crop": "wheat",
                "area_hectares": 10.5,
                "avg_temperature": 24,
                "expected_rainfall": 120,
            },
        )
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertEqual(body["crop"], "wheat")
        self.assertIn("expected_yield_tons", body)

    def test_missing_numeric_fields_use_defaults_and_succeed(self):
        res = self.app.post(
            "/predict-yield",
            headers=self.headers,
            json={"crop": "wheat", "area_hectares": 10},
        )
        self.assertEqual(res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
