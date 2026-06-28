import os
import json
import base64
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))


async def analyze_image(image_bytes: bytes) -> dict:
    """
    Send an image to Gemini 2.0 Flash for civic issue analysis.
    Returns a dict with category, severity, confidence, title, and description.
    """
    default_result = {
        "category": "other",
        "severity": "low",
        "confidence": 0.1,
        "title": "Unidentified Issue",
        "description": "No clear civic issue detected.",
    }

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Convert bytes to base64 string
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            "You are a civic issue detection AI. Analyze this image carefully. "
            "Return ONLY a raw JSON object (no markdown, no backticks, no explanation) "
            "with exactly these fields: "
            "category (must be one of: pothole, water_leakage, garbage, streetlight, other), "
            "severity (must be one of: low, medium, high, critical), "
            "confidence (a float between 0 and 1), "
            "title (a short 5-8 word title describing the issue), "
            "description (one clear sentence describing what you see and why it is a civic problem). "
            "If you cannot detect any civic issue, still return JSON with "
            "category: other, severity: low, confidence: 0.1, "
            "title: Unidentified Issue, description: No clear civic issue detected."
        )

        # Pass image as inline_data part using the updated SDK format
        response = model.generate_content(
            [
                prompt,
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": image_b64,
                    }
                },
            ]
        )

        raw_text = response.text.strip()
        print(f"\n[VisionAgent] Raw Gemini response:\n{raw_text}\n")

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            # Drop opening fence line (```json or ```)
            inner_lines = lines[1:] if lines[0].startswith("```") else lines
            # Drop closing fence line
            if inner_lines and inner_lines[-1].strip() == "```":
                inner_lines = inner_lines[:-1]
            raw_text = "\n".join(inner_lines).strip()

        # Handle if starts with "json" literal after stripping backticks
        if raw_text.startswith("json"):
            raw_text = raw_text[4:].strip()

        result = json.loads(raw_text)
        print(f"[VisionAgent] Parsed result: {result}")

        # Validate and coerce expected fields
        valid_categories = {"pothole", "water_leakage", "garbage", "streetlight", "other"}
        valid_severities = {"low", "medium", "high", "critical"}

        if result.get("category") not in valid_categories:
            result["category"] = "other"
        if result.get("severity") not in valid_severities:
            result["severity"] = "low"
        if not isinstance(result.get("confidence"), (int, float)):
            result["confidence"] = 0.0
        if not isinstance(result.get("description"), str) or not result.get("description"):
            result["description"] = "No description available."
        if not isinstance(result.get("title"), str) or not result.get("title"):
            result["title"] = "Unidentified Issue"

        return result

    except json.JSONDecodeError as e:
        print(f"[VisionAgent] JSON parse error: {e}")
        return default_result
    except Exception as e:
        print(f"[VisionAgent] Error during analysis: {e}")
        return default_result
