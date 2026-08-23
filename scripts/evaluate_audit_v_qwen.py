#!/usr/bin/env python3
"""Audit V — Post-Training Generation Test Script.

Loads base model Qwen/Qwen2.5-3B-Instruct + fine-tuned LoRA adapter from
backend/models/audit_v_qwen_lora/ and generates responses for the 5 benchmark questions.

Saves output to:
- backend/models/audit_v_qwen_lora/evaluation_responses.json
"""

from __future__ import annotations

import json
import time
from pathlib import Path
import torch

from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_OUTPUT_DIR = ROOT_DIR / "backend" / "models" / "audit_v_qwen_lora"
MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"


def run_evaluation():
    print("=" * 65)
    print("AUDIT V - POST-TRAINING GENERATION EVALUATION")
    print("=" * 65)

    test_questions = [
        "What is Section 80C?",
        "Explain the difference between the old and new tax regimes.",
        "What is GST input tax credit?",
        "What is a fixed deposit?",
        "What should I consider before making an investment?",
    ]

    print(f"Loading Base Model '{MODEL_ID}' + Trained Adapter from '{MODEL_OUTPUT_DIR}'...")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_OUTPUT_DIR), trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )
    ft_model = PeftModel.from_pretrained(base_model, str(MODEL_OUTPUT_DIR))
    ft_model.eval()

    eval_responses = []

    for idx, q in enumerate(test_questions, 1):
        print(f"\n[Test {idx}/5] Question: '{q}'")
        messages = [
            {"role": "system", "content": "You are Audit V, an AI financial and tax intelligence assistant."},
            {"role": "user", "content": q},
        ]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

        t0 = time.time()
        with torch.no_grad():
            output_ids = ft_model.generate(
                **inputs,
                max_new_tokens=200,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        gen_time = time.time() - t0

        generated_text = tokenizer.decode(output_ids[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
        
        # Clean print without unicode charmap errors
        safe_preview = generated_text.replace("₹", "INR ")[:150]
        print(f"Generated ({gen_time:.2f}s): {safe_preview}...")

        eval_responses.append({
            "question_id": idx,
            "question": q,
            "answer": generated_text,
            "generation_time_seconds": round(gen_time, 2),
        })

    eval_file = MODEL_OUTPUT_DIR / "evaluation_responses.json"
    with open(eval_file, "w", encoding="utf-8") as f:
        json.dump(eval_responses, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Post-Training Generation Test PASSED! Responses saved to '{eval_file}'.")


if __name__ == "__main__":
    run_evaluation()
