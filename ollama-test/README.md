# Ollama Local Network Setup Guide

This guide helps you set up Ollama on your local network so it's accessible from other devices (like your Docker containers).

## Prerequisites

- Your PC with Ollama installed (192.168.1.123)
- Docker installed (if running containers)

## Step 1: Install Ollama on Your PC

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS
```bash
brew install ollama
ollama serve
```

### Windows
Download from: https://ollama.com/download/OllamaSetup.exe

## Step 2: Configure Ollama to Listen on Network Interface

By default, Ollama only listens on localhost (127.0.0.1). To make it accessible from other devices:

### Create systemd service override (Linux)

```bash
sudo systemctl edit ollama
```

Add this content:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Save and exit.

### Restart Ollama
```bash
sudo systemctl restart ollama
sudo systemctl enable ollama
```

### Verify Ollama is listening on all interfaces
```bash
ss -tlnp | grep 11434
```

You should see something like:
```
LISTEN 0      4096     0.0.0.0:11434      0.0.0.0:*    users:(("ollama",pid=1234,fd=8))
```

## Step 3: Configure Firewall (if enabled)

```bash
# Allow Ollama port
sudo ufw allow 11434

# Check status
sudo ufw status
```

## Step 4: Test Ollama from Another Device

From your Docker container or another device on the network:

```bash
curl http://192.168.1.123:11434/api/tags
```

You should see a list of available models.

## Step 5: Pull a Model

On your PC where Ollama is running:

```bash
ollama pull qwen2.5-coder:8b
```

Verify the model is available:
```bash
ollama list
```

## Step 6: Test from Docker Container

From the `bytebudd` directory:

```bash
cd /home/parsa/self_project/webapp/bytebudd
docker compose up -d
```

Check backend logs:
```bash
docker compose logs -f backend
```

## Troubleshooting

### Connection Refused
- Make sure Ollama service is running: `sudo systemctl status ollama`
- Check if port 11434 is open: `sudo ufw status`
- Verify Ollama is listening on 0.0.0.0, not just 127.0.0.1

### Can't Reach from Docker
- Ensure Docker container can reach the host IP
- Check if firewall is blocking connections
- Try from inside container: `docker compose exec backend curl http://192.168.1.123:11434/api/tags`

### Model Not Found
- Make sure you pulled the model on the PC running Ollama: `ollama pull qwen2.5-coder:8b`
- Check available models: `ollama list`

## Security Notes

⚠️ **Important**: Exposing Ollama on 0.0.0.0 makes it accessible to anyone on your network. Consider:

1. Using a firewall to restrict access to specific IPs
2. Setting up authentication if needed
3. Not exposing port 11434 to the internet
