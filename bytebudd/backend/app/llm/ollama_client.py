"""
Ollama LLM client for ByteBudd.
Handles both streaming and non-streaming completion requests.
"""

import json
import logging
from typing import AsyncIterator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaError(Exception):
    """Raised when Ollama returns an error or times out."""
    pass


class OllamaClient:
    """Thin async wrapper around the Ollama HTTP API."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout

    async def is_available(self) -> bool:
        """Check if Ollama is reachable and the model is ready."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code != 200:
                    return False
                data = response.json()
                model_names = [m["name"] for m in data.get("models", [])]
                # Check if any model name starts with our model (handles :latest suffix)
                return any(
                    m.startswith(self.model.split(":")[0]) for m in model_names
                )
        except Exception:
            return False

    async def generate(self, prompt: str) -> str:
        """
        Generate a complete (non-streaming) response from Ollama.

        Args:
            prompt: The full prompt string.

        Returns:
            The generated text response.

        Raises:
            OllamaError: On connection failure or timeout.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,   # Low temp for deterministic SQL
                "top_p": 0.9,
                "num_predict": 512,   # SQL queries are short
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "").strip()

        except httpx.TimeoutException:
            raise OllamaError(f"Ollama request timed out after {self.timeout}s")
        except httpx.HTTPStatusError as e:
            raise OllamaError(f"Ollama HTTP error {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise OllamaError(f"Ollama connection error: {e}")

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        """
        Stream tokens from Ollama as they are generated.

        Yields:
            Individual text tokens as strings.

        Raises:
            OllamaError: On connection failure or timeout.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
                "num_predict": 512,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                yield token
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            logger.warning(f"Ollama non-JSON chunk: {line}")
                            continue

        except httpx.TimeoutException:
            raise OllamaError(f"Ollama streaming timed out after {self.timeout}s")
        except httpx.HTTPStatusError as e:
            raise OllamaError(f"Ollama HTTP error {e.response.status_code}")
        except Exception as e:
            raise OllamaError(f"Ollama streaming error: {e}")

    async def pull_model(self) -> AsyncIterator[str]:
        """Pull/download the configured model from Ollama registry."""
        payload = {"name": self.model, "stream": True}

        async with httpx.AsyncClient(timeout=600) as client:
            async with client.stream(
                "POST", f"{self.base_url}/api/pull", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            status = chunk.get("status", "")
                            if status:
                                yield status
                        except json.JSONDecodeError:
                            continue


# Singleton client instance
ollama_client = OllamaClient()
