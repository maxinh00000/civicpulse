import math
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from models import IssueCreate, IssueResponse, VoteRequest
from supabase_client import supabase
from agents.duplicate_agent import check_duplicate

router = APIRouter(prefix="/issues", tags=["Issues"])


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lng points."""
    R = 6371  # Earth radius in km
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


@router.post("/", response_model=dict)
async def create_issue(issue: IssueCreate):
    """Create a new issue. Checks for duplicates first."""
    try:
        # Check for duplicates
        dup_result = await check_duplicate(
            issue.latitude, issue.longitude, issue.category
        )

        if dup_result["is_duplicate"]:
            # Fetch the existing issue
            existing = (
                supabase.table("issues")
                .select("*")
                .eq("id", dup_result["existing_issue_id"])
                .single()
                .execute()
            )
            return {
                "merged": True,
                "message": (
                    f"Duplicate issue found {dup_result['distance_meters']}m away. "
                    f"Merging with issue #{dup_result['existing_issue_id']}."
                ),
                "existing_issue": existing.data,
            }

        # Insert new issue
        new_issue = {
            "title": issue.title,
            "description": issue.description,
            "category": issue.category,
            "severity": issue.severity,
            "latitude": issue.latitude,
            "longitude": issue.longitude,
            "address": issue.address,
            "reporter_id": issue.reporter_id,
            "status": "open",
            "votes": 0,
            "image_url": issue.image_url,
            "confidence": issue.confidence,
        }

        response = supabase.table("issues").insert(new_issue).execute()

        return {"merged": False, "issue": response.data[0]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create issue: {str(e)}")


@router.get("/", response_model=list[dict])
async def list_issues(
    lat: Optional[float] = Query(None, description="Latitude for proximity filter"),
    lng: Optional[float] = Query(None, description="Longitude for proximity filter"),
    radius_km: float = Query(5, description="Radius in km (default 5)"),
):
    """List all open issues, optionally filtered by proximity."""
    try:
        response = (
            supabase.table("issues")
            .select("*")
            .neq("status", "resolved")
            .execute()
        )

        issues = response.data

        # Apply proximity filter if lat/lng provided
        if lat is not None and lng is not None:
            issues = [
                issue
                for issue in issues
                if _haversine(lat, lng, float(issue["latitude"]), float(issue["longitude"]))
                <= radius_km
            ]

        return issues

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list issues: {str(e)}")


@router.get("/nearby")
async def get_nearby_issues(lat: float, lng: float, radius_km: float = 3.0):
    """Return all open issues within radius_km of the given coordinates."""
    try:
        result = supabase.table("issues").select("*").neq("status", "resolved").execute()
        all_issues = result.data or []

        nearby = []
        for issue in all_issues:
            dist = _haversine(lat, lng, float(issue["latitude"]), float(issue["longitude"]))
            dist_meters = dist * 1000  # _haversine returns km
            if dist_meters <= radius_km * 1000:
                issue["distance_meters"] = int(dist_meters)
                nearby.append(issue)

        nearby.sort(key=lambda x: x["distance_meters"])

        return {
            "issues": nearby,
            "count": len(nearby),
            "summary": f"{len(nearby)} issue{'s' if len(nearby) != 1 else ''} found within {radius_km}km"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{issue_id}", response_model=dict)
async def get_issue(issue_id: str):
    """Get a single issue by ID."""
    try:
        response = (
            supabase.table("issues")
            .select("*")
            .eq("id", issue_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Issue not found")

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get issue: {str(e)}")


@router.post("/{issue_id}/vote", response_model=dict)
async def vote_issue(issue_id: str, vote: VoteRequest):
    """Vote on an issue. Increments the vote count."""
    try:
        # Check if user already voted
        existing_vote = (
            supabase.table("votes")
            .select("id")
            .eq("issue_id", issue_id)
            .eq("user_id", vote.user_id)
            .execute()
        )

        if existing_vote.data:
            raise HTTPException(
                status_code=400, detail="User has already voted on this issue"
            )

        # Insert vote record
        supabase.table("votes").insert(
            {"issue_id": issue_id, "user_id": vote.user_id}
        ).execute()

        # Get current vote count and increment
        issue = (
            supabase.table("issues")
            .select("votes")
            .eq("id", issue_id)
            .single()
            .execute()
        )

        if not issue.data:
            raise HTTPException(status_code=404, detail="Issue not found")

        new_votes = (issue.data.get("votes") or 0) + 1

        supabase.table("issues").update({"votes": new_votes}).eq(
            "id", issue_id
        ).execute()

        return {"message": "Vote recorded", "votes": new_votes}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to vote: {str(e)}")


@router.post("/{issue_id}/resolve", response_model=dict)
async def resolve_issue(issue_id: str):
    """Mark an issue as resolved."""
    try:
        # Verify issue exists
        issue = (
            supabase.table("issues")
            .select("id, status")
            .eq("id", issue_id)
            .single()
            .execute()
        )

        if not issue.data:
            raise HTTPException(status_code=404, detail="Issue not found")

        if issue.data["status"] == "resolved":
            raise HTTPException(status_code=400, detail="Issue is already resolved")

        supabase.table("issues").update({"status": "resolved"}).eq(
            "id", issue_id
        ).execute()

        return {"message": f"Issue #{issue_id} marked as resolved"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to resolve issue: {str(e)}"
        )
