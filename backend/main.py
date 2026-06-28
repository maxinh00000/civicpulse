import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import issues, upload, agents

app = FastAPI(
    title="CivicPulse API",
    description="Backend API for the CivicPulse civic issue reporting platform.",
    version="1.0.0",
)

# CORS — allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(issues.router)
app.include_router(upload.router)
app.include_router(agents.router)


async def _escalation_loop():
    """Background task: run escalation agent every 5 minutes automatically."""
    from agents.escalation_agent import run_escalation
    while True:
        try:
            result = await run_escalation()
            print(
                f"[AutoEscalation] Ran escalation — "
                f"{result.get('escalated_count', 0)} issue(s) escalated."
            )
        except Exception as e:
            print(f"[AutoEscalation] Error: {e}")
        await asyncio.sleep(300)  # Wait 5 minutes


@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup."""
    asyncio.create_task(_escalation_loop())
    print("[Startup] Auto-escalation background task started (runs every 5 minutes).")


@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "CivicPulse API"}

