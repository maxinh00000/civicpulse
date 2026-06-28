import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
