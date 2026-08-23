import gc
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

print("=" * 60)
print("AUDIT V - QWEN 2.5 3B 4-BIT GPU TEST")
print("=" * 60)

print(f"Model: {MODEL_ID}")
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

if not torch.cuda.is_available():
    raise RuntimeError("CUDA is not available.")

print(f"GPU: {torch.cuda.get_device_name(0)}")

total_vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
print(f"Total VRAM: {total_vram:.2f} GB")

torch.cuda.empty_cache()

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

print("\nLoading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
)

print("Tokenizer loaded.")

print("\nLoading 4-bit model...")

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=quantization_config,
    device_map="auto",
    torch_dtype=torch.float16,
    trust_remote_code=True,
)

print("Model loaded successfully.")

allocated = torch.cuda.memory_allocated() / (1024 ** 3)
reserved = torch.cuda.memory_reserved() / (1024 ** 3)

print("\nGPU memory after model loading:")
print(f"Allocated: {allocated:.2f} GB")
print(f"Reserved:  {reserved:.2f} GB")
print(f"Free approximately: {total_vram - reserved:.2f} GB")

messages = [
    {
        "role": "system",
        "content": (
            "You are Audit V, a financial and tax intelligence assistant. "
            "Provide educational, grounded explanations and do not invent "
            "financial or tax rules."
        ),
    },
    {
        "role": "user",
        "content": "Explain Section 80C of the Indian Income Tax system in simple terms.",
    },
]

prompt = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)

inputs = tokenizer(
    prompt,
    return_tensors="pt",
).to(model.device)

print("\nGenerating test response...")

with torch.inference_mode():
    outputs = model.generate(
        **inputs,
        max_new_tokens=120,
        do_sample=False,
        temperature=None,
        top_p=None,
    )

generated_tokens = outputs[0][inputs["input_ids"].shape[-1]:]

response = tokenizer.decode(
    generated_tokens,
    skip_special_tokens=True,
)

print("\n" + "=" * 60)
print("MODEL RESPONSE")
print("=" * 60)
print(response)

print("\n" + "=" * 60)
print("FINAL GPU MEMORY")
print("=" * 60)

allocated = torch.cuda.memory_allocated() / (1024 ** 3)
reserved = torch.cuda.memory_reserved() / (1024 ** 3)

print(f"Allocated: {allocated:.2f} GB")
print(f"Reserved:  {reserved:.2f} GB")

del outputs
del inputs
del model
del tokenizer

gc.collect()
torch.cuda.empty_cache()

print("\nQwen 2.5 3B 4-bit test completed.")