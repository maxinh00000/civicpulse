import httpx
import math
from typing import List


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Returns distance in meters between two coordinates."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """
    Calculate compass bearing from point 1 to point 2.
    Returns a string like 'north', 'northeast', 'east', etc.
    """
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlon_r = math.radians(lon2 - lon1)

    x = math.sin(dlon_r) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon_r)

    bearing_deg = math.degrees(math.atan2(x, y))
    bearing_deg = (bearing_deg + 360) % 360  # Normalize to 0-360

    # Convert degrees to compass direction
    directions = [
        "north", "northeast", "east", "southeast",
        "south", "southwest", "west", "northwest", "north"
    ]
    index = int((bearing_deg + 22.5) / 45)
    return directions[index]


def decode_polyline(encoded: str) -> list:
    """Decode Google-style polyline encoding used by OSRM."""
    points = []
    index = 0
    lat, lng = 0, 0
    while index < len(encoded):
        for is_lng in [False, True]:
            shift, result = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            value = ~(result >> 1) if result & 1 else result >> 1
            if is_lng:
                lng += value
                points.append((lat / 1e5, lng / 1e5))
            else:
                lat += value
    return points


async def check_route_safety(origin: dict, destination: dict, issues: list, mode: str = "driving") -> list:
    """
    origin: {"lat": float, "lng": float}
    destination: {"lat": float, "lng": float}
    issues: list of issue dicts from Supabase
    mode: OSRM profile - 'driving', 'cycling', or 'foot'
    Returns list of warnings for issues near the route.
    """
    warnings = []

    # Normalize mode - transit maps to foot since OSRM public API does not support transit
    osrm_mode = mode if mode in {"driving", "cycling", "foot"} else "driving"

    try:
        # Call OSRM for route geometry
        url = (
            f"http://router.project-osrm.org/route/v1/{osrm_mode}/"
            f"{origin['lng']},{origin['lat']};{destination['lng']},{destination['lat']}"
            f"?overview=full&geometries=polyline"
        )
        print(f"[RouteSafety] OSRM URL: {url}")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            print("[RouteSafety] OSRM failed, using straight-line fallback")
            route_coords = [
                (origin["lat"], origin["lng"]),
                (destination["lat"], destination["lng"])
            ]
        else:
            polyline = data["routes"][0]["geometry"]
            route_coords = decode_polyline(polyline)
            print(f"[RouteSafety] Route decoded: {len(route_coords)} points")

        threshold_meters = 500
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

        for issue in issues:
            if issue.get("status") == "resolved":
                continue

            issue_lat = issue.get("latitude")
            issue_lng = issue.get("longitude")
            if issue_lat is None or issue_lng is None:
                continue

            min_distance = float("inf")
            closest_coord = route_coords[0] if route_coords else (origin["lat"], origin["lng"])
            for coord in route_coords:
                dist = haversine(coord[0], coord[1], issue_lat, issue_lng)
                if dist < min_distance:
                    min_distance = dist
                    closest_coord = coord

            if min_distance <= threshold_meters:
                severity = issue.get("severity", "low")
                category = issue.get("category", "other")
                dist_display = int(min_distance)

                warning_message = f"{severity.upper()} {category.replace('_', ' ')} detected {dist_display}m from your route"

                bearing = calculate_bearing(
                    closest_coord[0], closest_coord[1],
                    issue_lat, issue_lng
                )

                warnings.append({
                    "issue_id": issue.get("id"),
                    "title": issue.get("title", "Unknown issue"),
                    "category": category,
                    "severity": severity,
                    "distance_meters": dist_display,
                    "warning_message": warning_message,
                    "latitude": issue_lat,
                    "longitude": issue_lng,
                    "bearing": bearing,
                })

        warnings.sort(key=lambda w: (severity_order.get(w["severity"], 4), w["distance_meters"]))
        return warnings

    except Exception as e:
        print(f"Route safety error: {e}")
        return []
