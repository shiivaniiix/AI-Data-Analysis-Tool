# DataChat AI (Codezista)

Full-stack AI SaaS starter for uploading CSV/Excel files, generating insights/charts, and chatting with data.

## Stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: FastAPI (Python)
- Database: PostgreSQL (Supabase)
- Storage: Supabase Storage / S3
- AI: OpenAI
- Data processing: DuckDB

## Project Structure

- `frontend/` - Next.js app
- `backend/` - FastAPI API

## Frontend Run

```bash
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Runs at `http://localhost:3000`.

## Backend Run

```bash
cd backend
Copy-Item .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Runs at `http://localhost:8000`.

## Health Check

- `GET http://localhost:8000/api/health`
