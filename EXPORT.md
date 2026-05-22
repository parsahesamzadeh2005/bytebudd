# Exporting & Importing ByteBudd Docker Images

Use this when you want to move ByteBudd to another machine without rebuilding from source.

---

## Export (on the source machine)

Make sure the images are built and running first:

```bash
docker compose up --build -d
```

Then run the export script:

```bash
./export-images.sh
```

This saves both images (`bytebudd-backend` and `bytebudd-frontend`) into a single compressed archive:

```
bytebudd-images.tar.gz  (~350–400 MB)
```

### Custom output path

```bash
./export-images.sh -o /tmp/bytebudd-images.tar.gz
```

---

## Transfer to another machine

Use `scp`, a USB drive, or any file transfer method:

```bash
scp bytebudd-images.tar.gz user@remote-host:/home/user/bytebudd/
```

---

## Import (on the target machine)

### 1. Copy the project files

The target machine needs the project files (compose file, config, etc.) but does **not** need to build anything.

```bash
git clone <repo-url> bytebudd
cd bytebudd
```

Or just copy the `bytebudd/` folder directly.

### 2. Load the images

```bash
docker load -i bytebudd-images.tar.gz
```

You should see:

```
Loaded image: bytebudd-backend:latest
Loaded image: bytebudd-frontend:latest
```

### 3. Set up the environment file

```bash
cp .env.example .env
# Edit .env and set SECRET_KEY, ENCRYPTION_KEY, OLLAMA_BASE_URL
```

### 4. Start the stack

```bash
docker compose up -d
```

Docker will use the loaded images directly — no build step needed.

### 5. First-time setup (migrations + admin user)

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/create_admin.py
```

The app will be available at **http://localhost**.

---

## Notes

- The exported archive includes only the `backend` and `frontend` images. Base images (`postgres`, `mysql`, `nginx`) are small and pulled automatically from Docker Hub on first run.
- If the target machine has no internet access, also export those base images and load them the same way.
- The archive does **not** include database data. To migrate data as well, use `pg_dump` / `pg_restore` separately.
