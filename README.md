# CivicPulse 🚦

**AI-powered hyperlocal civic issue reporting platform** — built for Vibe2Ship Hackathon, Problem Statement 2: Community Hero.

🔗 **Live App:** https://civicpulse-300626-5655f.web.app/
🔗 **Backend API:** https://trivedhu-civicpulse-backend.hf.space

---

## What is CivicPulse?

CivicPulse turns a single photo into actionable civic data. Citizens report infrastructure problems — potholes, water leakages, garbage, broken streetlights — and a network of AI agents automatically categorizes, verifies, tracks, and surfaces them on a live map. The platform also proactively warns travelers about hazards along their route, like a "Waze for civic problems."

---

## Key Features

- **One-tap photo reporting** — upload an image, Gemini Vision AI auto-detects category, severity, and confidence
- **Live interactive map** — emoji-based markers, color-coded by category, sized/shaded by severity
- **Duplicate Detection Agent** — merges nearby reports of the same issue instead of cluttering the map
- **Route Safety Agent** — checks a planned route via OSRM and warns of hazards along the way
- **Nearby Issues Alert** — surfaces all open reports within 1km of the user
- **Community voting** — confirmations and votes automatically escalate severity
- **Severity Escalation Agent** — runs on-demand and on a background interval to re-evaluate unresolved issues
- **Authority Recommendation** — shows relevant authority contacts and AI-generated complaint text per category
- **Graceful degradation** — if the Gemini API quota is exhausted, manual reporting still works; the app never blocks issue creation

---

## AI Agents

| Agent | Trigger | Function |
|---|---|---|
| Vision Agent | Image uploaded | Gemini-powered analysis → category, severity, confidence, auto-generated title/description |
| Duplicate Detection Agent | New report submitted | Haversine-distance proximity check, merges duplicate reports within 100m |
| Route Safety Agent | Route requested | OSRM route analysis, surfaces hazards within threshold distance, ranked by severity |
| Severity Escalation Agent | Manual + background interval | Auto-escalates severity based on votes and report age |
| Nearby Hazard Agent | App load / geolocation | Returns all open issues within 1km, sorted by distance |

---

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet.js, OpenStreetMap
**Backend:** FastAPI (Python)
**Database & Storage:** Supabase (PostgreSQL + Storage)
**AI:** Gemini 2.5 Flash (Vision) via Google AI Studio
**Routing/Geocoding:** OSRM, Nominatim
**Hosting:** Firebase Hosting (frontend), Hugging Face Spaces — Docker (backend)

---

## Architecture

```
Browser
   ↓
Firebase Hosting (React frontend)
   ↓ REST API
Hugging Face Spaces — Docker (FastAPI backend)
   ↓
Supabase (DB + Storage) · Gemini API (Vision) · OSRM (routing) · Nominatim (geocoding)
```

**Note on deployment:** Backend was originally planned for Google Cloud Run, but billing could not be enabled on the available Google account in time. The backend is deployed on Hugging Face Spaces (Docker SDK) as a fully functional alternative. The frontend remains on Firebase Hosting (Google Cloud Platform). Gemini 2.5 Flash, a core Google AI technology, powers the primary Vision Agent.

---

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
# create .env with SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, GEMINI_API_KEY
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Future Improvements

- Migrate backend to Google Cloud Run once billing is set up, for full GCP-native deployment
- Real-time turn-by-turn navigation with live distance-based hazard alerts (similar to Google Maps)
- Predictive Agent — forecast recurring issues using historical/seasonal data (e.g. monsoon water leakages)
- Trend Analysis Agent — generate area-wise weekly summaries
- Natural Language Map Agent — query the map conversationally ("show severe potholes near my college")
- Gamification — badges, points, leaderboards for active community reporters
- Resolution Verification Agent — automatically compare before/after images to confirm a fix
- Push notifications for hazards on saved/frequent routes
- Multi-language support for wider community accessibility

---

## Team / Submission

Built for Vibe2Ship Hackathon — Problem Statement 2: Community Hero – Hyperlocal Problem Solver.
