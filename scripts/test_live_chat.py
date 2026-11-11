import urllib.request
import json
import time

url = "http://127.0.0.1:8000/api/v1/assistant/chat"
data = json.dumps({"message": "What is the standard deduction?", "stream": True}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Connecting to live Audit V SSE stream...")
t0 = time.time()
ttft = None
tokens_received = 0
current_event = "message"
rag_sources = []

with urllib.request.urlopen(req) as resp:
    print(f"Status: {resp.status} | Content-Type: {resp.headers.get('Content-Type')}")
    for line in resp:
        line_str = line.decode("utf-8").rstrip("\r\n")
        if not line_str:
            continue
        if line_str.startswith("event:"):
            current_event = line_str.split(":", 1)[1].strip()
        elif line_str.startswith("data:"):
            data_str = line_str.split(":", 1)[1].strip()
            try:
                payload = json.loads(data_str)
                if current_event == "metadata":
                    rag_sources = payload.get("sources", [])
                    print(f"\n[METADATA RECEIVED: {len(rag_sources)} RAG Sources, Intent: {payload.get('intent')}]")
                    for s in rag_sources:
                        print(f"  - {s.get('title')} ({int(s.get('similarity_score', 0)*100)}% match)")
                    print("\n[STREAMING ANSWER TOKENS]:")
                elif current_event == "token":
                    content = payload.get("content", "")
                    if ttft is None:
                        ttft = time.time() - t0
                        print(f"\n>>> TTFT (Time To First Token): {ttft:.3f}s <<<")
                    print(content, end="", flush=True)
                    tokens_received += 1
                elif current_event == "done":
                    print("\n\n[DONE EVENT RECEIVED]")
            except Exception as e:
                print(f"\n[Parse error: {e} on data: {data_str}]")

total_time = time.time() - t0
generation_time = (total_time - (ttft or 0))
tok_per_sec = tokens_received / generation_time if generation_time > 0 else 0

print(f"\n" + "="*50)
print(f"Audit V Live SSE Stream Benchmark")
print(f"="*50)
print(f"RAG Sources:       {len(rag_sources)}")
print(f"TTFT:              {ttft:.3f}s")
print(f"Generation Time:   {generation_time:.3f}s")
print(f"Total Time:        {total_time:.3f}s")
print(f"Tokens Received:   {tokens_received}")
print(f"Generation Speed:  {tok_per_sec:.2f} tokens/sec")
print(f"="*50)
