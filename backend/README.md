# DataChat AI Backend

FastAPI backend for DataChat AI (Codezista).

## Run locally

1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy env template:
   ```bash
   Copy-Item .env.example .env
   ```
   By default `DATABASE_URL` uses **SQLite** (`sqlite:///./datachat.db`) so you do not need PostgreSQL locally. Tables are created on API startup.

   **Using PostgreSQL (e.g. Supabase):** set `DATABASE_URL` to a `postgresql+psycopg://...` value and install the driver:
   ```bash
   pip install -r requirements-postgres.txt
   ```
   
   **OTP email (Resend):**
   - `RESEND_API_KEY`: from [Resend](https://resend.com) (no quotes, no spaces in `.env`).
   - Files loaded from the **backend** directory (not the shell cwd): `.env` first, then `.env.local` (overrides). Copy `.env.example` to `.env` and set the key.
   - If `RESEND_API_KEY` is missing, the API stays up; signup OTP routes return **503** with a clear message (not 500).

4. Start server:
   ```bash
   # Windows note: avoid --reload in long-running dev/prod-like runs to prevent
   # subprocess/socket exhaustion (WinError 10055). Use a single uvicorn instance.
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --graceful-timeout 10
   
   ```

## Health check

`GET /api/health`

## Auth routes

Passwords are stored with **PBKDF2-HMAC-SHA256** (via passlib), not bcrypt—long passwords are supported and there is no 72-byte limit. If you previously used bcrypt in this project, existing password hashes will not verify; sign up again or clear the `users` table for local dev.

- `POST /api/auth/signup/start`
- `POST /api/auth/signup/verify`
- `POST /api/auth/signup/resend`
- `POST /api/auth/login`
- `POST /api/auth/delete-account` (requires Bearer JWT)

## Chat routes

- `GET /api/chats` (list user chats)
- `POST /api/chats` (create a new empty chat)
- `POST /api/chats/{chat_id}/upload` (multipart/form-data: `file`)
- `GET /api/chats/{chat_id}/messages`
- `POST /api/chats/{chat_id}/messages` (JSON: `{ "message": "..." }`)
- `DELETE /api/chats/{chat_id}`
- `GET /api/chats/{chat_id}/insights`
- `POST /api/chats/{chat_id}/chart-data`
- `POST /api/chats/{chat_id}/data-csv` (returns `text/csv`)
- `POST /api/chats/{chat_id}/export/csv` (returns `text/csv`)
- `POST /api/chats/{chat_id}/export/pdf` (returns `application/pdf`)
- `POST /api/chats/{chat_id}/export/docx` (returns Word `.docx`)

## Dev utility route

- `POST /api/dev/clear-test-data` (dev-only; enabled when `DEBUG_SHOW_OTP=true`)
  - Deletes unverified users and related rows (`user_otps`, `chat_sessions`, `chat_messages`, `chat_permissions`)
  - Runs orphan cleanup for those related tables
  - Returns: `"Test data cleared successfully"` with deletion counts
