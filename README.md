# CivicPulse 🌐

CivicPulse is a modern, AI-augmented civic issue reporting and routing platform that helps citizens report infrastructure hazards (like potholes, water leakage, broken streetlights, or garbage), automatically detects duplicates to merge duplicate concerns, triggers automatic escalation, and provides turn-by-turn navigation alerts to safely route drivers, cyclists, and pedestrians around reported hazards.

---

## 🚀 Key Features

### 1. 🤖 AI-Powered Vision Issue Analysis
* **Automated Categorization**: Uploading an image in the issue reporting form runs real-time visual analysis using the **Gemini 2.0 Flash** model to detect categories (`pothole`, `water_leakage`, `garbage`, `streetlight`, `other`) and severity ratings (`low`, `medium`, `high`, `critical`).
* **Auto-Filled Title & Description**: Dynamically generates descriptive titles and detailed summaries from images.
* **✨ AI suggested Badges**: Form input fields display a dynamic label indicating recommendations, which gracefully clear when the user starts typing manually.

### 2. 🗺️ Turn-by-Turn Navigation & Hazard Alerts
* **Google Maps-Style Map Click Details**: Clicking on the map pins a location and pops up a bottom HUD showing reverse-geocoded addresses (fetched via a secure backend proxy) with options to get **Directions**, **Start Navigation** instantly, or **Report an Issue**.
* **Live Route Warnings**: Draws routes using **OSRM APIs** (supporting Driving, Cycling, and Walking). Checks active hazards within 500m of the path and updates a top persistent HUD bar:
  * 🟢 **Green**: Clear route.
  * 🟡 **Yellow**: Hazard ahead within 800m.
  * 🟠 **Orange**: Hazard warning within 400m.
  * 🔴 **Red (Pulsing)**: Caution immediately ahead within 100m.
* **Sequential Passing Detection**: Recalculates distance dynamically; if a hazard's distance increases for 3 consecutive GPS position updates (using `watchPosition`), it is marked as passed.
* **Hazards Floating List**: Displays a floating panel on the left detailing upcoming hazards sorted by distance, with their emoji, category, severity, and compass bearing directions (e.g. `north`, `southwest` etc.).

### 3. 🔍 Silent Duplicate Detection Agent
* **Automated Merging**: Backend compares new submissions against nearby active issues of the same category within 100m.
* **Frontend Duplicate Warning**: Submitting a duplicate alerts the user with a warning card showing the distance to the existing issue, automatically increments confirmation votes on the original report, and lets the user click **View Existing Issue** directly.

### 4. 🏥 Centralized Agent Health Tooltip
* **Diagnostic Route**: `/agents/health` tests all 5 agents (Vision, Duplicate, Route Safety, Escalation, Database/Nearby) independently via a 1x1 test image.
* **Sidebar Indicator**: Visual status dot on the dashboard header (Green for Healthy, Yellow for Degraded, Red for Offline) with a hover tooltip displaying status checkmarks (✅/❌) for each agent.

### 5. 📢 Background Auto-Escalation Loop
* **FastAPI asyncio Task**: Periodically runs a background task every 5 minutes on server start that automatically escalates open high-priority/unconfirmed issues to municipal authorities.

---

## 🛠️ Technology Stack
* **Frontend**: React (TypeScript), Tailwind CSS, Leaflet.js (Map container)
* **Backend**: FastAPI (Python), httpx, asyncio
* **AI/LLM**: Google Generative AI (Gemini 2.0 Flash)
* **Database & Storage**: Supabase (PostgreSQL + Supabase Storage for uploads)

---

## ⚙️ Environment Variables Setup

### Backend Environment Configuration (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-google-gemini-api-key
```

---

## 📦 Installation & Getting Started

### 1. Run Supabase Database Schema
Set up the `issues` table in your Supabase SQL Editor:
```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('pothole', 'water_leakage', 'garbage', 'streetlight', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence FLOAT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  address TEXT,
  image_url TEXT,
  votes INTEGER DEFAULT 0,
  reporter_id TEXT NOT NULL,
  merged_into UUID REFERENCES issues(id)
);
```
Create a storage bucket named `issue-images` in Supabase Storage with **public accessibility enabled**.

### 2. Start the Backend Server
```bash
cd backend
python -m venv venv
# On Windows:
$env:PATH="venv\Scripts;$env:PATH"
pip install -r requirements.txt
uvicorn main:app --reload
```
The server will boot on `http://localhost:8000`.

### 3. Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
```
The client app will launch on `http://localhost:5173`.
