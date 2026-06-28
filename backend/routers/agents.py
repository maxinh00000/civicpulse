import base64
from fastapi import APIRouter, HTTPException
from models import RouteRequest
from agents.route_safety_agent import check_route_safety
from agents.escalation_agent import run_escalation
from agents.duplicate_agent import check_duplicate
from agents.vision_agent import analyze_image
from supabase_client import supabase

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("/route-safety")
async def route_safety(request: RouteRequest):
    """Check a route for nearby civic issues and return warnings."""
    try:
        result = supabase.table("issues").select("*").neq("status", "resolved").execute()
        issues = result.data or []
        warnings = await check_route_safety(
            origin={"lat": request.origin.lat, "lng": request.origin.lng},
            destination={"lat": request.destination.lat, "lng": request.destination.lng},
            issues=issues,
            mode=request.mode,
        )
        return {"warnings": warnings, "total": len(warnings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route safety check failed: {str(e)}")


@router.post("/escalate", response_model=dict)
async def escalate():
    """Manually trigger the escalation agent."""
    try:
        result = await run_escalation()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Escalation failed: {str(e)}")


@router.get("/health", response_model=dict)
async def agent_health():
    """Test all agents and return their individual status."""
    statuses: dict = {}

    # 1. Vision Agent - tiny 1x1 white JPEG
    try:
        tiny_jpeg_b64 = (
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
            "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
            "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
            "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
            "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA"
            "/9oADAMBAAIRAxEAPwCwABmX/9k="
        )
        tiny_jpeg = base64.b64decode(tiny_jpeg_b64)
        vision_result = await analyze_image(tiny_jpeg)
        statuses["vision_agent"] = "ok" if isinstance(vision_result, dict) and "category" in vision_result else "error"
    except Exception as e:
        statuses["vision_agent"] = f"error: {str(e)[:60]}"

    # 2. Duplicate Agent
    try:
        dup_result = await check_duplicate(latitude=12.9716, longitude=77.5946, category="pothole")
        statuses["duplicate_agent"] = "ok" if isinstance(dup_result, dict) and "is_duplicate" in dup_result else "error"
    except Exception as e:
        statuses["duplicate_agent"] = f"error: {str(e)[:60]}"

    # 3. Route Safety Agent
    try:
        safety_result = await check_route_safety(
            origin={"lat": 12.9716, "lng": 77.5946},
            destination={"lat": 12.9352, "lng": 77.6245},
            issues=[],
        )
        statuses["route_safety_agent"] = "ok" if isinstance(safety_result, list) else "error"
    except Exception as e:
        statuses["route_safety_agent"] = f"error: {str(e)[:60]}"

    # 4. Escalation Agent
    try:
        esc_result = await run_escalation()
        statuses["escalation_agent"] = "ok" if isinstance(esc_result, dict) and "escalated_count" in esc_result else "error"
    except Exception as e:
        statuses["escalation_agent"] = f"error: {str(e)[:60]}"

    # 5. Nearby Agent / Database
    try:
        supabase.table("issues").select("id").limit(1).execute()
        statuses["nearby_agent"] = "ok"
        statuses["database"] = "ok"
    except Exception as e:
        statuses["nearby_agent"] = f"error: {str(e)[:60]}"
        statuses["database"] = f"error: {str(e)[:60]}"

    all_ok = all(v == "ok" for v in statuses.values())
    statuses["overall"] = "healthy" if all_ok else "degraded"
    return statuses


@router.get("/summary", response_model=dict)
async def get_summary():
    """Get a summary of all issues: totals, by category, by severity, most active area."""
    try:
        response = supabase.table("issues").select("*").execute()
        issues = response.data

        total = len(issues)
        open_count = sum(1 for i in issues if i.get("status") != "resolved")
        resolved_count = sum(1 for i in issues if i.get("status") == "resolved")

        by_category: dict = {}
        by_severity: dict = {}
        area_counts: dict = {}

        for issue in issues:
            cat = issue.get("category", "other")
            sev = issue.get("severity", "low")
            address = issue.get("address", "Unknown")
            by_category[cat] = by_category.get(cat, 0) + 1
            by_severity[sev] = by_severity.get(sev, 0) + 1
            area_counts[address] = area_counts.get(address, 0) + 1

        most_active_area = max(area_counts, key=area_counts.get) if area_counts else "N/A"

        return {
            "total_issues": total,
            "open": open_count,
            "resolved": resolved_count,
            "by_category": by_category,
            "by_severity": by_severity,
            "most_active_area": most_active_area,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@router.post("/geocode", response_model=dict)
async def geocode_address(payload: dict):
    """Secure geocoding proxy via Nominatim."""
    address = payload.get("address", "")
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
    try:
        import httpx
        headers = {"User-Agent": "CivicPulse/1.0 (contact: thriv@example.com)"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"format": "json", "q": address, "limit": 1},
                headers=headers,
            )
            data = response.json()
            if not data:
                return {"success": False, "message": "Address not found"}
            return {"success": True, "lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/reverse-geocode", response_model=dict)
async def reverse_geocode(payload: dict):
    """Secure reverse geocoding proxy via Nominatim."""
    lat = payload.get("lat")
    lng = payload.get("lng")
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude are required")
    try:
        import httpx
        headers = {"User-Agent": "CivicPulse/1.0 (contact: thriv@example.com)"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"format": "json", "lat": lat, "lon": lng},
                headers={**headers, "Accept-Language": "en"}
            )
            data = response.json()
            if not data or "display_name" not in data:
                return {"success": False, "message": "Address not found"}
            return {
                "success": True,
                "address": data["display_name"],
            }
    except Exception as e:
        return {"success": False, "message": str(e)}
