import os
import json
import base64
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

async def analyze_image(image_bytes: bytes, model_name: str = "gemini-2.5-flash") -> dict:
    default_result = {
        'category': 'other',
        'severity': 'low',
        'confidence': 0.1,
        'title': 'Unidentified Issue',
        'description': 'Could not analyze image.'
    }

    try:
        base64_string = base64.b64encode(image_bytes).decode('utf-8')
        model = genai.GenerativeModel(model_name)
        image_part = {'inline_data': {'mime_type': 'image/jpeg', 'data': base64_string}}
        
        prompt_text = (
            'Analyze this image. It may show a civic infrastructure problem like a pothole, '
            'water leakage, garbage dump, or broken streetlight. Respond with ONLY a JSON object. '
            'No markdown. No backticks. No explanation. Just the raw JSON. Use exactly these fields: '
            'category (must be exactly one of: pothole, water_leakage, garbage, streetlight, other), '
            'severity (must be exactly one of: low, medium, high, critical), '
            'confidence (a number between 0.0 and 1.0), '
            'title (a short descriptive title of 5 to 8 words), '
            'description (one sentence describing the civic problem visible in the image). '
            'If you see a pothole or road damage, use pothole. If you see standing water or pipe leakage, '
            'use water_leakage. If you see trash or garbage, use garbage. If you see a broken or missing '
            'streetlight, use streetlight.'
        )

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: model.generate_content([image_part, prompt_text])
        )

        print('GEMINI RAW RESPONSE:', response.text)

        # Clean the response: strip whitespace, remove ```json and ``` if present
        cleaned_text = response.text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()

        result = json.loads(cleaned_text)

        # Validate that category is one of the allowed values, if not set to 'other'
        allowed_categories = {'pothole', 'water_leakage', 'garbage', 'streetlight', 'other'}
        if result.get('category') not in allowed_categories:
            result['category'] = 'other'

        # Validate that severity is one of the allowed values, if not set to 'low'
        allowed_severities = {'low', 'medium', 'high', 'critical'}
        if result.get('severity') not in allowed_severities:
            result['severity'] = 'low'

        return result

    except Exception as e:
        print('VISION AGENT ERROR:', str(e))
        return default_result
