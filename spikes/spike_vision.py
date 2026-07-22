"""Spike C: Cloud Vision web detection -- powers the provenance / recycled-footage feature.

Point Vision at a YouTube thumbnail URL (no download needed) and ask where else that image
appears on the web. This is what lets us flag footage that predates the video's upload.

Uses Application Default Credentials (no service-account JSON). If you get an auth error,
run once:  gcloud auth application-default login

Run:  .venv\\Scripts\\python spikes\\spike_vision.py
Throwaway test code -- not part of the app.
"""
import sys
from google.cloud import vision

VIDEO_ID = "klhX42PAzsk"
image_url = f"https://i.ytimg.com/vi/{VIDEO_ID}/hq2.jpg"

print(f"Running web detection on {image_url}\n")

try:
    client = vision.ImageAnnotatorClient()
except Exception as e:
    print("AUTH/SETUP ERROR creating the Vision client:")
    print("  ", str(e)[:400])
    print("\nMost likely fix: run  gcloud auth application-default login")
    sys.exit(1)

image = vision.Image()
image.source.image_uri = image_url

resp = client.web_detection(image=image)
if resp.error.message:
    print("Vision API returned an error:")
    print("  ", resp.error.message[:400])
    print("\nIf it mentions the API being disabled, enable vision.googleapis.com on the project.")
    sys.exit(1)

web = resp.web_detection

print("pages_with_matching_images:", len(web.pages_with_matching_images))
for p in web.pages_with_matching_images[:5]:
    print("   page:", p.url)

print("full_matching_images:", len(web.full_matching_images))
for i in web.full_matching_images[:5]:
    print("   full:", i.url)

print("partial_matching_images:", len(web.partial_matching_images))
for i in web.partial_matching_images[:5]:
    print("   partial:", i.url)

print("\nPASS - Vision web detection ran and returned without an auth/API error.")
print("(Few/no matches just means this particular image isn't widespread online.)")
