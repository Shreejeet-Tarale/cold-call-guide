# Cold Call Guide

A lightweight, stage-driven web application that helps sales representatives conduct structured cold calls, capture prospect responses, and review call outcomes.

**Live application:** https://cold-call-guide-3qhp4wjhe-hackitbro.vercel.app/  
**Backend API:** https://cold-call-guide-api.onrender.com  
**Interactive API documentation:** https://cold-call-guide-api.onrender.com/docs

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Workflow](#workflow)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Data Model](#data-model)
- [AI Summary](#ai-summary)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Testing Checklist](#testing-checklist)
- [Security and Privacy](#security-and-privacy)
- [Potential Improvements](#potential-improvements)
- [License](#license)

## Overview

Cold Call Guide provides a focused workspace for representatives who need to follow a consistent call structure while capturing relevant details from a conversation. It presents an eight-stage call guide, records stage-level actions and notes, and stores call outcomes for later review.

The application is built as a full-stack web product using React, FastAPI, Supabase PostgreSQL, and an AI-powered call-summary workflow.

## Key Features

- **Eight-stage call guide:** Each stage presents its purpose, common prospect responses, and quick-action options.
- **Live call workflow:** Start a call, progress through stages, capture the prospect's words, and record an outcome.
- **Call history:** Review saved calls, statuses, outcomes, and the furthest stage reached.
- **Persistent storage:** Store calls and stage-level results in Supabase.
- **AI-generated summaries:** Generate and save a post-call summary using the Gemini API when generation succeeds.
- **API documentation:** Inspect and test endpoints through FastAPI's Swagger UI.
- **Local development support:** Run the frontend and backend locally.

## Workflow

1. The representative starts a call from the Live Call screen.
2. The application loads the eight configured stages from the backend.
3. At each stage, the representative selects relevant actions and can enter the prospect's words.
4. Stage results are saved through the API and persisted in Supabase.
5. The representative ends the call and records an outcome.
6. The backend requests an AI-generated summary and stores it with the call, when summary generation succeeds.
7. The saved call can be reviewed from Past Calls.

## Architecture

```text
React + Vite frontend (Vercel)
            |
         HTTPS API
            |
      FastAPI backend (Render)
          /       \
         /         \
Supabase PostgreSQL  Google Gemini API
  call records        call summaries
  stage results
```

The frontend communicates with FastAPI over HTTP. The backend handles database operations and calls to Gemini. Privileged credentials must remain on the server and must never be exposed in frontend code.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| Database | Supabase PostgreSQL |
| Database client | Supabase Python client |
| AI summaries | Google Gemini API via `google-genai` |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| API exploration | FastAPI Swagger UI |

## Repository Structure

```text
cold-call-guide/
├── backend/
│   ├── main.py                 # FastAPI application and API routes
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Environment-variable template
│   └── .env                    # Local secrets; do not commit
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Live call workflow and navigation
│   │   ├── PastCalls.jsx       # Call history
│   │   ├── main.jsx            # Frontend entry point
│   │   └── index.css           # Global styles
│   ├── package.json
│   └── vite.config.js
├── data/
│   └── stages.json             # Eight-stage call guide configuration
├── docs/
│   ├── transcript-findings.md  # Findings from supplied transcripts
│   └── ui-plan.md              # UI workflow and screen plan
├── private_transcripts/        # Private source material; do not commit
├── supabase/
│   └── schema.sql              # Database schema
├── .gitignore
└── README.md
```

Local-only files and private source material may be intentionally absent from the public repository.

## Data Model

The database uses two primary tables.

### `calls`

Stores one record per call, including prospect and company details, timestamps, latest stage reached, call status, outcome, and an AI-generated summary when available.

### `stage_results`

Stores the stage number, selected action options, prospect notes or words, timestamps, and the associated call ID. The schema defines a foreign-key relationship to `calls` and enforces one result per call and stage.

Review `supabase/schema.sql` for the authoritative schema.

## AI Summary

When a call ends, the frontend requests a summary from the backend. The backend gathers the saved call and stage-result data, sends the relevant content to the configured Gemini model, and saves the generated summary to the call record.

Summary generation depends on valid backend configuration and Gemini API availability. A call should remain saved even if summary generation fails; check the frontend status and backend logs when troubleshooting.

Do not send confidential prospect information to an AI provider unless you have the appropriate authorization and have reviewed the provider's data-handling terms.

## Local Development

### Prerequisites

- Python 3.10 or later, subject to the versions supported by project dependencies
- Node.js and npm
- A Supabase project with the schema applied
- A Gemini API key to test AI summaries

### 1. Clone the repository

```bash
git clone <YOUR_PUBLIC_GITHUB_REPOSITORY_URL>
cd cold-call-guide
```

Replace the placeholder with the actual GitHub repository URL.

### 2. Set up the backend

From the repository root, create and activate a virtual environment:

**Windows PowerShell**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Create `backend/.env` using `backend/.env.example` as a template, then provide your own credentials. See [Environment Variables](#environment-variables).

Start the backend from the repository root:

```powershell
python -m uvicorn backend.main:app --reload --port 8000
```

The local API should be available at `http://127.0.0.1:8000`. Swagger documentation is at `http://127.0.0.1:8000/docs`.

### 3. Set up Supabase

1. Open your Supabase project and navigate to the SQL Editor.
2. Review and run `supabase/schema.sql`.
3. Confirm that the `calls` and `stage_results` tables exist.
4. Configure the backend with your Supabase project URL and server-side secret.

Avoid running test insert statements repeatedly against a shared database, as this can create duplicate records.

### 4. Set up the frontend

Open a terminal in the `frontend` directory:

```powershell
cd frontend
npm install
```

Create `frontend/.env.local` with the local API URL:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the development server:

```powershell
npm run dev
```

Open the URL printed by Vite. If the default port is occupied, Vite may select another port.

### 5. Build the frontend

From the `frontend` directory:

```powershell
npm run build
```

The production build is generated in `frontend/dist/`.

## Environment Variables

Configure backend variables in `backend/.env` locally and in the Render service environment for deployment.

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Backend | Server-side database credential |
| `GEMINI_API_KEY` | Backend | Authenticates Gemini API requests |
| `GEMINI_MODEL` | Backend | Model identifier used for summary generation |
| `ALLOWED_ORIGINS` | Backend | Comma-separated list of permitted frontend origins |
| `VITE_API_BASE_URL` | Frontend | Base URL for the FastAPI service |

Use the exact variable names expected by `backend/.env.example` and the current application code. Keep `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` out of frontend source code and out of all `VITE_` variables: Vite variables are bundled into client-side assets and should be treated as public.

## API Overview

**Base URL:** `https://cold-call-guide-api.onrender.com`  
**Interactive documentation:** https://cold-call-guide-api.onrender.com/docs

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Basic service response |
| `GET` | `/health` | Backend health check |
| `GET` | `/db-health` | Database connectivity check |
| `GET` | `/stages` | Retrieve the eight configured stages |
| `POST` | `/calls` | Start a call |
| `POST` | `/calls/{call_id}/stages` | Save a stage result |
| `POST` | `/calls/{call_id}/end` | End a call and record its outcome |
| `POST` | `/calls/{call_id}/summary` | Generate and persist an AI summary |
| `GET` | `/calls` | Retrieve recent calls |
| `GET` | `/calls/{call_id}` | Retrieve a call and its stage results |
| `GET` | `/stats/calls-by-stage` | Count calls by stage reached |

Use the Swagger documentation for the current request schemas, response formats, and validation requirements.

## Deployment

### Frontend — Vercel

- **Project root:** `frontend`
- **Framework:** Vite
- **Install command:** `npm install`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variable:** `VITE_API_BASE_URL=https://cold-call-guide-api.onrender.com`

### Backend — Render

Configure the Render service to install dependencies from `backend/requirements.txt` and start the FastAPI application using the service's configured root directory and start command. Set all required backend environment variables in Render; do not commit them to the repository.

Set `ALLOWED_ORIGINS` to the exact frontend origin and any local origins needed for development. Avoid broad wildcard origins for an application that handles user data.

### Database — Supabase

Apply `supabase/schema.sql` and configure the backend to connect to the intended Supabase project. Keep privileged database credentials on the backend only.

After deployment, verify health endpoints, stage loading, call creation, stage saving, call completion, Past Calls, and summary persistence.

## Testing Checklist

Before presenting or submitting the project, verify the complete workflow with fictional or dummy data:

- [ ] The deployed frontend loads.
- [ ] The backend health endpoint responds successfully.
- [ ] The backend returns all eight stages.
- [ ] A new call can be created.
- [ ] Stage selections and prospect notes are saved.
- [ ] Ending a call records the outcome and status.
- [ ] The call appears in Past Calls.
- [ ] AI summary generation succeeds and the summary is saved.
- [ ] The frontend production build completes successfully.
- [ ] No secrets or private transcript files are tracked by Git.
- [ ] The repository links and documented file structure match the actual repository.

Passing tests confirms the behavior that was tested; it does not, by itself, establish production security or reliability.

## Security and Privacy

This project should be treated as a demonstration application unless production controls have been implemented and reviewed.

- Keep `.env`, `.env.local`, API keys, database secrets, and other credentials out of version control.
- Keep `private_transcripts/` and confidential source material out of the public repository.
- Use fictional or authorized data for demonstrations and testing.
- Restrict CORS to frontend origins that need access.
- Review API access controls. If endpoints are publicly callable without authentication, do not use the deployment for real prospect information or sensitive business data.
- Consider authentication, authorization, rate limiting, input validation, logging controls, and abuse protection before production use.
- Rotate any credential that has been exposed. Removing it from the latest commit alone is not sufficient.

## Potential Improvements

Possible future improvements include:

- Authentication and per-user authorization for calls
- API rate limiting and abuse protection
- Improved timeout, retry, and error handling for AI summary generation
- Automated backend and frontend tests
- Structured logging and deployment monitoring
- Pagination and richer filtering for larger call histories
- A documented data-retention policy

Only mark these improvements as completed after they have been implemented and verified.

## License

No license has been specified in this repository. Unless a license file is added, all rights remain with the copyright holder and reuse is not automatically granted.
