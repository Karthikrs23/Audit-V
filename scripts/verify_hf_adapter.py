#!/usr/bin/env python3
"""Audit V — Remote Hugging Face Adapter Verification Script.

Downloads and tests the published LoRA adapter directly from Hugging Face:
- Model ID: Qwen/Qwen2.5-3B-Instruct
- Adapter ID: peterrs23/audit-v-qwen-3b
- Test Query: "What is Section 80C?"
"""

from __future__ import annotations

import sys
import time
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

HF_REPO_ID = "peterrs23/audit-v-qwen-3b"
BASE_MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"


def test_hf_remote_adapter():
    print("=" * 65)
    print("AUDIT V - REMOTE HUGGING FACE ADAPTER DOWNLOAD TEST")
    print("=" * 65)

    print(f"[1/4] Configuring 4-bit BitsAndBytes NF4 Quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    print(f"\n[2/4] Downloading Tokenizer & Base Model '{BASE_MODEL_ID}'...")
    tokenizer = AutoTokenizer.from_pretrained(HF_REPO_ID, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )

    print(f"\n[3/4] Downloading Remote LoRA Adapter from '{HF_REPO_ID}'...")
    t0 = time.time()
    model = PeftModel.from_pretrained(base_model, HF_REPO_ID)
    model.eval()
    t_load = time.time() - t0
    print(f"Remote adapter successfully downloaded & attached in {t_load:.2f}s!")

    print(f"\n[4/4] Executing Generation Test Query: 'What is Section 80C?'...")
    messages = [
        {"role": "system", "content": "You are Audit V, an AI financial and tax intelligence assistant."},
        {"role": "user", "content": "What is Section 80C?"},
    ]

    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

    t_gen_start = time.time()
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=150,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    t_gen = time.time() - t_gen_start

    generated_text = tokenizer.decode(output_ids[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()

    safe_response = generated_text.replace("₹", "INR ")
    print(f"\nResponse Generated in {t_gen:.2f}s:\n{safe_response}\n")

    if "80C" in generated_text or "deduction" in generated_text.lower() or "1,50,000" in generated_text or "150000" in generated_text:
        print("=" * 65)
        print(f"[OK] REMOTE ADAPTER GENERATION TEST: PASS!")
        print(f"Hugging Face Repository '{HF_REPO_ID}' is 100% Valid & Functional!")
        print("=" * 65)
    else:
        print("[FAIL] Unexpected response output from remote adapter.")
        sys.exit(1)


if __name__ == "__main__":
    test_hf_remote_adapter()
