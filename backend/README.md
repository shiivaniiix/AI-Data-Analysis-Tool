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
   
   **OTP email (Gmail SMTP):**
   - `EMAIL_SENDER`: your Gmail address
   - `EMAIL_PASSWORD`: Gmail App Password (not your normal login password)
   - SMTP host/port are configured in code as `smtp.gmail.com:587` (STARTTLS).
   - If sending fails, backend logs the OTP as a development fallback and does not crash signup.

4. Start server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Health check

`GET /api/health`

## Auth routes

Passwords are stored with **PBKDF2-HMAC-SHA256** (via passlib), not bcrypt—long passwords are supported and there is no 72-byte limit. If you previously used bcrypt in this project, existing password hashes will not verify; sign up again or clear the `users` table for local dev.

- `POST /api/auth/signup`
- `POST /api/auth/verify-otp`
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
