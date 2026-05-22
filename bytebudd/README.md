# 🤖 ByteBudd — Self-Hosted AI SQL Assistant

ByteBudd converts natural language into safe, read-only SQL queries using a local Ollama AI model. No external APIs. No data leaves your server.

```
User Question → Schema Extraction → Ollama LLM → SQL Validation → Execution → SSE Streaming
```

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start (Docker)](#quick-start)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Supported Databases](#supported-databases)
7. [Troubleshooting](#troubleshooting)
8. [Development Guide](#development-guide)

---

## Overview

**ByteBudd is:**
- ✅ Fully self-hosted (no cloud required)
- ✅ Read-only SQL enforcement via sqlglot
- ✅ Supports PostgreSQL, MySQL, MariaDB, SQLite
- ✅ WordPress, WooCommerce, PrestaShop schema-aware
- ✅ Streams responses in real-time (SSE)
- ✅ Simple JWT authentication
- ✅ Dockerized — runs with one command

**ByteBudd is NOT:**
- ❌ A write-access tool (INSERT/UPDATE/DELETE are always blocked)
- ❌ Connected to external AI APIs (Ollama only)
- ❌ A data visualization tool (MVP scope)

---

## Architecture

```
Internet
    │
    ▼
┌─────────┐
│  Nginx  │  Port 80 — entry point
│  :80    │  / → frontend  │  /api → backend
└────┬────┘
     │
     ├──────────────────────────┐
     ▼                          ▼
┌──────────┐              ┌──────────┐
│ Frontend │              │ Backend  │
│ Next.js  │              │ FastAPI  │
│ :3000    │              │ :8000    │
└──────────┘              └────┬─────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Postgres │    │  Ollama  │    │ Target   │
        │ (ByteBudd│    │ LLM :11434    │ Database │
        │  data)   │    └──────────┘    │ (yours)  │
        └──────────┘                   └──────────┘
```

**Request flow:**
1. User types question in browser
2. Frontend POSTs to `/api/v1/query/stream`
3. Backend fetches the target DB schema
4. Schema + question sent to Ollama (`qwen2.5-coder:8b`)
5. SQL validated by sqlglot (read-only enforcement)
6. Query executed against target DB
7. Results streamed back via SSE events

---

## Quick Start

### Prerequisites

- Docker Engine 24+
- Docker Compose v2+
- 8GB RAM minimum (for Ollama model)
- 10GB disk space (model is ~5GB)

### Step 1 — Clone and configure

```bash
git clone https://github.com/yourorg/bytebudd.git
cd bytebudd

# Copy and edit environment file
cp .env.example .env
# Edit .env — at minimum change SECRET_KEY and ENCRYPTION_KEY
```

### Step 2 — Start all services

```bash
docker compose up -d
```

### Step 3 — Initialize (run once)

```bash
# Option A: Use the init script
chmod +x scripts/init.sh
./scripts/init.sh

# Option B: Manual steps
docker compose exec backend alembic upgrade head
docker compose exec backend python /app/../scripts/create_admin.py
docker compose exec ollama ollama pull qwen2.5-coder:8b
```

### Step 4 — Open ByteBudd

```
http://localhost
```

Default credentials:
- **Email:** `admin@bytebudd.local`
- **Password:** `admin123`

> ⚠️ Change the admin password after first login!

---

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | (change me) | JWT signing secret — use a random 64-char string |
| `ENCRYPTION_KEY` | (change me) | Database password encryption key — 32+ chars |
| `DATABASE_URL` | postgres://... | ByteBudd's internal Postgres URL |
| `OLLAMA_BASE_URL` | http://ollama:11434 | Ollama service URL |
| `OLLAMA_MODEL` | qwen2.5-coder:8b | Model to use |
| `OLLAMA_TIMEOUT` | 120 | LLM request timeout in seconds |
| `CORS_ORIGINS` | http://localhost | Allowed frontend origins |

---

## API Reference

Interactive docs available at: `http://localhost/api/docs`

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Login, returns JWT token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/register` | Create user (admin only) |

### Databases

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/databases/` | List connections |
| POST | `/api/v1/databases/` | Create connection |
| POST | `/api/v1/databases/{id}/test` | Test connection |
| GET | `/api/v1/databases/{id}/schema` | Get schema |
| DELETE | `/api/v1/databases/{id}` | Delete connection |

### Query (SSE)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/query/stream` | Ask a question (SSE stream) |
| GET | `/api/v1/query/ollama/status` | Check Ollama availability |

**SSE Events:**
```
event: thinking   → {"message": "Reading schema..."}
event: sql        → {"sql": "SELECT ..."}
event: results    → {"columns": [...], "rows": [...], "row_count": 42}
event: explanation→ {"text": "Found 42 rows..."}
event: done       → {"message": "Query complete"}
event: error      → {"message": "Error description"}
```

---

## Supported Databases

| Database | Status | Notes |
|---|---|---|
| PostgreSQL | ✅ Full | asyncpg driver |
| MySQL 8+ | ✅ Full | aiomysql driver |
| MariaDB | ✅ Full | Same driver as MySQL |
| SQLite | ✅ Full | File must be accessible in container |
| WordPress/WooCommerce | ✅ Schema hints | Connect to WP's MySQL/MariaDB |
| PrestaShop | ✅ Schema hints | Connect to PS's MySQL/MariaDB |

---

## Troubleshooting

### Ollama model not loading
```bash
# Check Ollama status
docker compose exec ollama ollama list

# Pull the model manually
docker compose exec ollama ollama pull qwen2.5-coder:8b

# Check API status
curl http://localhost/api/v1/query/ollama/status
```

### Database migrations not running
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current
```

### Backend won't start
```bash
docker compose logs backend
# Common: DATABASE_URL wrong, or Postgres not ready yet
```

### Frontend can't reach backend
```bash
# Check nginx routing
curl http://localhost/api/health
# Should return: {"status": "ok", ...}
```

### "SQL validation failed" errors
The SQL guard blocked an unsafe query. This is correct behavior.
The LLM generated a write operation — try rephrasing your question.

---

## Development Guide

### Run backend locally (outside Docker)
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+asyncpg://... uvicorn app.main:app --reload
```

### Run frontend locally
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost/api npm run dev
```

### Add a new API endpoint
1. Create route in `backend/app/api/v1/your_route.py`
2. Register in `backend/app/api/v1/__init__.py`
3. Add Pydantic schemas in `backend/app/schemas/`

### Add a new database connector
1. Create `backend/app/db_connectors/your_connector.py`
2. Implement `BaseConnector` (test_connection, get_schema, execute_query)
3. Register in `backend/app/db_connectors/connector_factory.py`

### Run with MySQL dev database
```bash
docker compose --profile mysql up -d
```

---

## Production Deployment

```bash
# 1. Set strong secrets in .env
# 2. Use production compose override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Initialize
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/create_admin.py
docker compose exec ollama ollama pull qwen2.5-coder:8b
```

For HTTPS, add an SSL certificate to the nginx config or place behind a reverse proxy like Caddy/Traefik.
