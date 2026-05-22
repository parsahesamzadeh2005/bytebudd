#!/usr/bin/env python3
"""
Simple Ollama connection test script.
Tests if Ollama is reachable and lists available models.
"""

import requests
import sys
import json


def test_ollama_connection(base_url: str = "http://192.168.1.99:11434"):
    """Test Ollama connection and list models."""
    
    # Test 1: Check if Ollama is reachable
    print(f"Testing Ollama connection at: {base_url}")
    print("-" * 50)
    
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=10)
        response.raise_for_status()
        
        print("✅ Ollama is reachable!")
        print()
        
        # Parse and display models
        data = response.json()
        models = data.get("models", [])
        
        if not models:
            print("⚠️  No models found. You may need to pull a model:")
            print("   ollama pull qwen3-coder:30b")
            return False
        
        print(f"📦 Found {len(models)} model(s):")
        print()
        
        for model in models:
            print(f"  - {model.get('name', 'Unknown')}")
            print(f"    Digest: {model.get('digest', 'N/A')}")
            print()
        
        return True
        
    except requests.exceptions.ConnectionError as e:
        print("❌ Connection failed!")
        print(f"   Error: {e}")
        print()
        print("Possible solutions:")
        print("  1. Make sure Ollama is running on your PC")
        print("  2. Check if Ollama is configured to listen on 0.0.0.0")
        print("  3. Verify firewall allows port 11434")
        print("  4. Check if IP address 192.168.1.99 is correct")
        return False
        
    except requests.exceptions.Timeout:
        print("❌ Connection timed out!")
        print("   Ollama may be slow or unresponsive")
        return False
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False


def test_model_generation(base_url: str = "http://192.168.1.99:11434", model: str = "qwen3-coder:30b"):
    """Test if a model can generate text."""
    
    print(f"\nTesting model generation with: {model}")
    print("-" * 50)
    
    try:
        # Check if model exists
        response = requests.get(f"{base_url}/api/tags", timeout=10)
        response.raise_for_status()
        
        models = response.json().get("models", [])
        model_names = [m.get("name", "") for m in models]
        
        if model not in model_names:
            print(f"⚠️  Model '{model}' not found!")
            print("   Available models:", model_namesa)
            print("   Pull the model with: ollama pull", model)
            return False
        
        # Test generation
        payload = {
            "model": model,
            "prompt": "Say hello",
            "stream": False
        }
        
        response = requests.post(
            f"{base_url}/api/generate",
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        print("✅ Model generation successful!")
        print(f"   Response: {result.get('response', 'N/A')}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Generation test failed: {e}")
        return False


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Ollama connection")
    parser.add_argument(
        "--url", "-u",
        default="http://192.168.1.99:11434",
        help="Ollama base URL (default: http://192.168.1.99:11434)"
    )
    parser.add_argument(
        "--test-generation", "-g",
        action="store_true",
        help="Test model generation (requires a model to be pulled)"
    )
    
    args = parser.parse_args()
    
    # Test connection
    success = test_ollama_connection(args.url)
    
    # Test generation if requested
    if args.test_generation and success:
        test_model_generation(args.url)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
