# ByteBudd — Setup Guide

This guide walks you through getting ByteBudd running from scratch, whether you want a quick Docker setup or a local development environment.

---

## What is ByteBudd?

ByteBudd is a self-hosted AI SQL assistant. You ask questions in plain English, and it generates and runs read-only SQL queries against your database using a local Ollama AI model. No data leaves your server.

**Stack:**
- **Frontend:** Next.js 15 + Tailwind CSS
- **Backend:** Python FastAPI
- **AI:** Ollama (local LLM, no external API)
- **Internal DB:** PostgreSQL 16
- **Proxy:** Nginx

---

## Prerequisites

Before you start, make sure you have these installed:

| Tool | Minimum Version | Check |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Git | any | `git --version` |

**Hardware requirements:**
- 8 GB RAM minimum (the AI model needs ~5 GB)
- 10 GB free disk space (model download is ~5 GB)

> If you want to run without Docker (local dev), you also need Node.js 20+ and Python 3.11+.

---

## Option A — Docker Setup (Recommended)

This is the fastest way to get everything running.

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd webapp/bytebudd
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Open `.env` and change these two values — everything else can stay as-is for local use:

```env
SECRET_KEY=replace-with-a-long-random-string-at-least-64-chars
ENCRYPTION_KEY=replace-with-exactly-32-characters!
```

To generate strong values quickly:

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate ENCRYPTION_KEY (must be exactly 32 chars)
openssl rand -base64 24 | head -c 32
```

> **Important:** If you're deploying to a server accessible from the internet, also update `CORS_ORIGINS` to your domain.

### 3. Configure Ollama

ByteBudd needs an Ollama instance to run the AI model. You have two options:

**Option A — Use a local Ollama (running on your machine, outside Docker):**

If you already have Ollama installed and running on your host machine, open `docker-compose.yml` and find the backend service. The `OLLAMA_BASE_URL` is already set to a local IP:

```yaml
- OLLAMA_BASE_URL=http://192.168.1.99:11434
```

Change `192.168.1.99` to your machine's local IP address. Find it with:

```bash
# Linux/Mac
ip route get 1 | awk '{print $7; exit}'

# Or
hostname -I | awk '{print $1}'
```

**Option B — Run Ollama inside Docker:**

Add this service to `docker-compose.yml` under `services:`:

```yaml
  ollama:
    image: ollama/ollama:latest
    container_name: bytebudd-ollama
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    networks:
      - bytebudd-net
```

Add `ollama_data:` under the `volumes:` section, and change the backend's `OLLAMA_BASE_URL` to:

```yaml
- OLLAMA_BASE_URL=http://ollama:11434
```

### 4. Start all services

```bash
docker compose up -d
```

This builds the images and starts Nginx, the backend, the frontend, and PostgreSQL. First build takes a few minutes.

Check everything is running:

```bash
docker compose ps
```

All services should show `running` or `healthy`.

### 5. Run database migrations

This creates all the tables ByteBudd needs in its internal Postgres database. Run it once:

```bash
docker compose exec backend alembic upgrade head
```

### 6. Create the admin user

```bash
docker compose exec backend python create_admin.py
```

This creates the default admin account:
- **Email:** `admin@bytebudd.local`
- **Password:** `admin123`

To use custom credentials instead:

```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=yourpassword backend python create_admin.py
```

### 7. Pull the AI model

This downloads the `qwen2.5-coder:8b` model (~5 GB). Run this against whichever Ollama instance you're using.

**If Ollama is running in Docker:**
```bash
docker compose exec ollama ollama pull qwen2.5-coder:8b
```

**If Ollama is running on your host machine:**
```bash
ollama pull qwen2.5-coder:8b
```

This takes a few minutes depending on your connection. You can check progress in the terminal output.

### 8. Open ByteBudd

```
http://localhost
```

Log in with the admin credentials from step 6, then change the password.

---

## Option B — Local Development (No Docker)

Use this if you want to run the backend and frontend directly on your machine for development.

### Backend

**Requirements:** Python 3.11+

```bash
cd bytebudd/backend

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

You need a running PostgreSQL instance. Create a database and user:

```sql
CREATE DATABASE bytebudd;
CREATE USER bytebudd WITH PASSWORD 'bytebudd_secret';
GRANT ALL PRIVILEGES ON DATABASE bytebudd TO bytebudd;
```

Set your environment variables (or create a `.env` file in the `backend/` folder):

```bash
export DATABASE_URL=postgresql+asyncpg://bytebudd:bytebudd_secret@localhost:5432/bytebudd
export SECRET_KEY=your-secret-key
export ENCRYPTION_KEY=your-32-char-key!!!!!!!!!!!!!!!!
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=qwen2.5-coder:8b
```

Run migrations and create the admin:

```bash
alembic upgrade head
python create_admin.py
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs will be at `http://localhost:8000/docs`.

### Frontend

**Requirements:** Node.js 20+

```bash
cd bytebudd/frontend

npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Frontend will be at `http://localhost:3000`.

---

## Connecting Your First Database

Once logged in:

1. Click **Databases** in the sidebar
2. Click **Add Connection**
3. Fill in your database details (host, port, name, user, password)
4. Click **Test Connection** to verify it works
5. Click **Save**

Supported databases: PostgreSQL, MySQL, MariaDB, SQLite.

Then go back to the home page, start a new conversation, select your database, and start asking questions.

---

## Production Deployment

For a production server, use the production compose override which disables volume mounts and enables proper logging:

```bash
# 1. Set strong secrets in .env (mandatory)
# 2. Set CORS_ORIGINS to your actual domain
# 3. Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Run migrations and create admin (same as development)
docker compose exec backend alembic upgrade head
docker compose exec backend python create_admin.py
```

For HTTPS, place ByteBudd behind a reverse proxy like Caddy or Traefik and point it at port 80.

---

## Troubleshooting

**Services won't start:**
```bash
docker compose logs backend
docker compose logs frontend
```

**Migrations fail:**
```bash
# Check if Postgres is healthy first
docker compose ps postgres

# Then retry
docker compose exec backend alembic upgrade head
```

**AI model not responding:**
```bash
# Check Ollama is reachable
curl http://localhost/api/v1/query/ollama/status

# List downloaded models
ollama list  # or: docker compose exec ollama ollama list

# Re-pull if missing
ollama pull qwen2.5-coder:8b
```

**Frontend can't reach the backend:**
```bash
# Test the API through Nginx
curl http://localhost/api/health
# Expected: {"status": "ok", ...}
```

**"SQL validation failed" errors:**
The AI generated a write query (INSERT/UPDATE/DELETE). This is intentional — ByteBudd only allows SELECT. Try rephrasing your question.

---

## Useful Commands

```bash
# View logs for a specific service
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and delete all data (volumes)
docker compose down -v

# Run a new database migration after schema changes
docker compose exec backend alembic revision --autogenerate -m "describe_change"
docker compose exec backend alembic upgrade head

# Change the AI model
# 1. Edit OLLAMA_MODEL in .env
# 2. Pull the new model
ollama pull codellama:13b
# 3. Restart the backend
docker compose restart backend
```
