# ByteBudd

A self-hosted AI SQL assistant. Connect your database, ask questions in plain English, and get safe read-only SQL results — powered by a local Ollama model.

---

## What it does

- Converts natural language questions into SQL using a local LLM (via Ollama)
- Executes queries against your connected databases (PostgreSQL, MySQL, MariaDB, SQLite)
- Streams results back in real time using Server-Sent Events
- Enforces read-only access — no INSERT, UPDATE, DELETE, or DROP ever runs
- Stores conversation history per user

---

## Tech stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | Next.js 15, React 18, Tailwind CSS      |
| Backend   | FastAPI (Python), SQLAlchemy (async)    |
| Database  | PostgreSQL (internal app DB)            |
| AI        | Ollama (local LLM, default: qwen2.5-coder:8b) |
| Proxy     | Nginx                                   |
| Container | Docker Compose                          |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2
- [Ollama](https://ollama.com) running and accessible (can be on the same machine or a remote host)
- The model pulled in Ollama: `ollama pull qwen2.5-coder:8b`

---

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd bytebudd
cp .env.example .env
```

Open `.env` and set at minimum:

```env
SECRET_KEY=<a long random string>
ENCRYPTION_KEY=<exactly 32 characters>
OLLAMA_BASE_URL=http://<your-ollama-host>:11434
```

### 2. Start the stack

```bash
./start.sh
```

On first run, add `--init` to run migrations and create the admin user:

```bash
./start.sh --init
```

The app will be available at **http://localhost**.  
API docs are at **http://localhost/api/docs**.

Default admin credentials (change after first login):
- Email: `admin@bytebudd.local`
- Password: `admin123`

---

## Running in production

```bash
./start.sh --prod --build --init
```

This uses `docker-compose.prod.yml` overrides: no volume mounts, `restart: always`, and structured logging.

Make sure your `.env` has strong values for `SECRET_KEY` and `ENCRYPTION_KEY` before deploying.

---

## Stopping

```bash
./stop.sh              # stop containers, keep data
./stop.sh --clean      # stop + delete all database volumes
./stop.sh --purge      # --clean + remove built images
```

---

## Creating additional users

Only admins can create new users. Use the `/api/v1/auth/register` endpoint (requires a valid admin JWT) or the Swagger UI at `/api/docs`.

To create the first admin manually:

```bash
docker compose exec backend python scripts/create_admin.py
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars to override the defaults.

---

## Project structure

```
bytebudd/
├── backend/              # FastAPI app
│   ├── app/
│   │   ├── api/v1/       # Route handlers (auth, databases, conversations, query)
│   │   ├── core/         # Config, DB engine, security, encryption
│   │   ├── db_connectors/# Async connectors for PG, MySQL, SQLite
│   │   ├── llm/          # Ollama HTTP client
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── prompts/      # LLM prompt builder
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/     # Query pipeline, SQL guard
│   ├── alembic/          # Database migrations
│   └── requirements.txt
├── frontend/             # Next.js app
│   └── src/
│       ├── app/          # Pages (login, home, databases, conversations)
│       ├── components/   # UI components (chat, layout)
│       ├── lib/          # API client, auth helpers, utilities
│       └── types/        # Shared TypeScript types
├── infrastructure/
│   ├── nginx/            # Nginx reverse proxy config
│   └── mysql/            # Sample MySQL init script (for local testing)
├── scripts/
│   ├── create_admin.py   # Admin user creation script
│   └── init.sh           # One-time initialization helper
├── docker-compose.yml        # Development stack
├── docker-compose.prod.yml   # Production overrides
├── start.sh                  # Start script with flags
├── stop.sh                   # Stop script with cleanup options
└── .env.example              # Environment variable template
```

---

## Environment variables

| Variable                    | Description                                      | Default                        |
|-----------------------------|--------------------------------------------------|--------------------------------|
| `SECRET_KEY`                | JWT signing secret — change in production        | (insecure default)             |
| `ENCRYPTION_KEY`            | Fernet key for stored DB passwords               | (insecure default)             |
| `DATABASE_URL`              | Internal PostgreSQL connection string            | points to `postgres` container |
| `OLLAMA_BASE_URL`           | Ollama API base URL                              | `http://ollama:11434`          |
| `OLLAMA_MODEL`              | Model name to use                                | `qwen2.5-coder:8b`             |
| `OLLAMA_TIMEOUT`            | Request timeout in seconds                       | `120`                          |
| `CORS_ORIGINS`              | Comma-separated list of allowed origins          | `http://localhost`             |
| `NEXT_PUBLIC_API_URL`       | API base URL seen by the browser                 | `http://localhost/api`         |
| `ADMIN_EMAIL`               | Default admin email for create_admin script      | `admin@bytebudd.local`         |
| `ADMIN_PASSWORD`            | Default admin password for create_admin script   | `admin123`                     |
