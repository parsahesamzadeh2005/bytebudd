# ─── Base stage ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

WORKDIR /app

# Proxy for apt and pip (host proxy reachable via Docker bridge at 172.17.0.1:2080)
ENV http_proxy=http://172.17.0.1:2080
ENV https_proxy=http://172.17.0.1:2080
ENV HTTP_PROXY=http://172.17.0.1:2080
ENV HTTPS_PROXY=http://172.17.0.1:2080

# Install system dependencies
RUN echo 'Acquire::http::Proxy "http://172.17.0.1:2080";' > /etc/apt/apt.conf.d/01proxy && \
    echo 'Acquire::https::Proxy "http://172.17.0.1:2080";' >> /etc/apt/apt.conf.d/01proxy && \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/01proxy

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Clear proxy so it doesn't leak into runtime
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=

# ─── Development stage ─────────────────────────────────────────────────────
FROM base AS development

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=development

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─── Production stage ──────────────────────────────────────────────────────
FROM base AS production

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

COPY . .

# Run Alembic migrations then start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]

EXPOSE 8000
