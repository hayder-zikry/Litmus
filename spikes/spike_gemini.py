"""Spike: prove our Gemini API key + model name actually work.

Run:  .venv\\Scripts\\python spikes\\spike_gemini.py

Success looks like: it prints a one-word reply. If the key is bad you'll get a 401/403;
if the model name is wrong you'll get a 404 (old models like gemini-1.5/2.0 are shut down).
Throwaway test code — not part of the app.
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

model = os.environ["GEMINI_MODEL"]
# Vertex AI mode: bills to the Google Cloud project (uses the free-trial credits), auth via ADC.
client = genai.Client(
    vertexai=True,
    project=os.environ["GOOGLE_CLOUD_PROJECT"],
    location=os.environ["GOOGLE_CLOUD_LOCATION"],
)

print(f"Testing model: {model}")

resp = client.models.generate_content(
    model=model,
    contents="Reply with exactly one word: hello",
)

print("Model replied:", resp.text.strip())
print("PASS - Gemini key and model both work.")
