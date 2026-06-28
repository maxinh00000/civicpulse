from datetime import datetime, timezone, timedelta
from supabase_client import supabase


async def run_escalation() -> dict:
    """
    Run escalation rules on all open issues.

    Rules:
    1. votes >= 5 and severity 'low'    → upgrade to 'medium'
    2. votes >= 10 and severity 'medium' → upgrade to 'high'
    3. created_at > 48 hours ago and still open → prefix title with 'ESCALATED: '
    """
    escalated_count = 0
    details: list[dict] = []

    try:
        response = (
            supabase.table("issues")
            .select("*")
            .eq("status", "open")
            .execute()
        )

        now = datetime.now(timezone.utc)

        for issue in response.data:
            updates: dict = {}
            reasons: list[str] = []

            votes = issue.get("votes", 0)
            severity = issue.get("severity", "low")
            title = issue.get("title", "")
            issue_id = issue["id"]

            # Rule 1: votes >= 5 and severity low → medium
            if votes >= 5 and severity == "low":
                updates["severity"] = "medium"
                reasons.append(f"Severity upgraded low→medium (votes={votes})")

            # Rule 2: votes >= 10 and severity medium → high
            if votes >= 10 and severity == "medium":
                updates["severity"] = "high"
                reasons.append(f"Severity upgraded medium→high (votes={votes})")

            # Rule 3: older than 48 hours → prefix ESCALATED:
            created_str = issue.get("created_at", "")
            if created_str:
                try:
                    created_at = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                    age = now - created_at
                    if age > timedelta(hours=48) and not title.startswith("ESCALATED: "):
                        updates["title"] = f"ESCALATED: {title}"
                        reasons.append(
                            f"Title escalated (age={age.days}d {age.seconds // 3600}h)"
                        )
                except (ValueError, TypeError):
                    pass

            if updates:
                supabase.table("issues").update(updates).eq("id", issue_id).execute()
                escalated_count += 1
                details.append(
                    {"issue_id": issue_id, "updates": updates, "reasons": reasons}
                )

        return {"escalated_count": escalated_count, "details": details}

    except Exception as e:
        return {"escalated_count": escalated_count, "details": details, "error": str(e)}
