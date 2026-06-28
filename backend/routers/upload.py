import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from agents.vision_agent import analyze_image
from supabase_client import supabase

router = APIRouter(prefix="/upload", tags=["Upload"])

BUCKET_NAME = "issue-images"


@router.post("/image", response_model=dict)
async def upload_image(file: UploadFile = File(...)):
    """
    Upload an image, analyze it with the vision agent, and store in Supabase Storage.
    Returns flattened JSON: image_url + all vision agent fields (category, severity,
    confidence, title, description) at the top level.
    """
    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: {', '.join(allowed_types)}",
        )

    try:
        image_bytes = await file.read()
        print(f"\n[Upload] Received file: {file.filename}, size: {len(image_bytes)} bytes, type: {file.content_type}")

        if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
            raise HTTPException(status_code=400, detail="Image must be under 10 MB")

        # Analyze image with Gemini vision agent
        print("[Upload] Calling vision agent...")
        analysis = await analyze_image(image_bytes)
        print(f"[Upload] Vision agent returned: {analysis}")

        # Upload to Supabase Storage
        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
        file_name = f"{uuid.uuid4()}.{ext}"
        file_path = f"uploads/{file_name}"

        print(f"[Upload] Uploading to Supabase bucket '{BUCKET_NAME}' at path: {file_path}")
        supabase.storage.from_(BUCKET_NAME).upload(
            path=file_path,
            file=image_bytes,
            file_options={"content-type": file.content_type or "image/jpeg"},
        )

        # Get public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)
        print(f"[Upload] Public URL: {public_url}")

        # Return flattened response — all fields at top level so frontend can read them directly
        return {
            "image_url": public_url,
            "file_path": file_path,
            "category": analysis.get("category", "other"),
            "severity": analysis.get("severity", "low"),
            "confidence": analysis.get("confidence", 0.1),
            "title": analysis.get("title", "Unidentified Issue"),
            "description": analysis.get("description", "No description available."),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Upload] ERROR: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process image: {str(e)}"
        )

