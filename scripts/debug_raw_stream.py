import urllib.request
import json
import time

url = "http://127.0.0.1:8000/api/v1/assistant/chat"
data = json.dumps({"message": "What is the standard deduction?", "stream": True}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Sending request to Audit V live chat...")
t0 = time.time()

with urllib.request.urlopen(req) as resp:
    print("Response status:", resp.status)
    print("Content-Type:", resp.headers.get("Content-Type"))
    raw = resp.read().decode("utf-8")
    print("RAW LENGTH:", len(raw))
    print("RAW PREVIEW:")
    print(raw[:1000])

print("Total time:", time.time() - t0)
