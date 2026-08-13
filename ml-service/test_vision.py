"""
Test suite for ML Service Computer Vision /predict-image endpoint
"""

import unittest
import io
import json
import base64
from PIL import Image
from app import app, API_KEY


class TestVisionEndpoint(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.headers = {"X-API-Key": API_KEY}

    def create_synthetic_leaf_image(self, spot_color=(50, 200, 50)):
        """Creates a synthetic 224x224 leaf image with specified RGB color"""
        img = Image.new("RGB", (224, 224), color=spot_color)
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        return buf

    def test_health_check_vision_supported(self):
        res = self.app.get("/health", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("vision_supported"))

    def test_predict_image_multipart_file(self):
        img_buf = self.create_synthetic_leaf_image(spot_color=(30, 220, 30))
        data = {
            "image": (img_buf, "leaf.jpg")
        }
        res = self.app.post("/predict-image", headers=self.headers, data=data, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertIn("diagnosis", body)
        self.assertIn("confidence", body)
        self.assertIn("freshness_score", body)
        self.assertIn("quality_grade", body)
        self.assertEqual(body["diagnosis"], "Healthy")

    def test_predict_image_json_base64(self):
        img_buf = self.create_synthetic_leaf_image(spot_color=(180, 100, 20))
        b64_str = base64.b64encode(img_buf.getvalue()).decode("utf-8")
        payload = {"image_base64": b64_str}
        
        res = self.app.post("/predict-image", headers=self.headers, json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertIn("diagnosis", body)
        self.assertIn("quality_grade", body)

    def test_predict_image_missing_payload(self):
        res = self.app.post("/predict-image", headers=self.headers, json={})
        self.assertEqual(res.status_code, 400)
        body = res.get_json()
        self.assertIn("No image payload provided", body.get("error", ""))


if __name__ == "__main__":
    unittest.main()
