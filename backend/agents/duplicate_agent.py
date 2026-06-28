import math
from supabase_client import supabase


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


async def check_duplicate(latitude: float, longitude: float, category: str) -> dict:
    """
    Check if a similar issue already exists within 100 meters.
    Returns duplicate info or a negative result.
    """
    try:
        response = (
            supabase.table("issues")
            .select("id, latitude, longitude, category")
            .eq("category", category)
            .neq("status", "resolved")
            .execute()
        )

        for issue in response.data:
            distance = _haversine(
                latitude, longitude,
                float(issue["latitude"]), float(issue["longitude"]),
            )
            if distance <= 100:
                return {
                    "is_duplicate": True,
                    "existing_issue_id": issue["id"],
                    "distance_meters": round(distance, 2),
                }

        return {"is_duplicate": False}

    except Exception:
        # On error, assume not a duplicate so the issue can still be created
        return {"is_duplicate": False}
