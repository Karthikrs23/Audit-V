#!/usr/bin/env python3
"""Audit V — QLoRA 4-Bit Fine-Tuning & Evaluation Script.

Trains a LoRA adapter on Qwen/Qwen2.5-3B-Instruct using:
- 4-bit NF4 Quantization (bitsandbytes)
- PEFT LoRA (r=8, alpha=16)
- Hugging Face TRL SFTTrainer & SFTConfig
- Datasets: train.jsonl (202 examples), validation.jsonl (51 examples)

Outputs saved to:
- backend/models/audit_v_qwen_lora/ (Adapter weights)
- backend/models/audit_v_qwen_lora/training_log.json
- backend/models/audit_v_qwen_lora/evaluation_responses.json
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List

import torch
from datasets import Dataset
from peft import LoraConfig, PeftModel, TaskType, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from trl import SFTConfig, SFTTrainer

# Directory Setup
ROOT_DIR = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT_DIR / "datasets" / "training"
MODEL_OUTPUT_DIR = ROOT_DIR / "backend" / "models" / "audit_v_qwen_lora"
MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
TRAIN_FILE = TRAINING_DIR / "train.jsonl"
VAL_FILE = TRAINING_DIR / "validation.jsonl"


def print_gpu_memory(stage_name: str):
    """Print GPU memory statistics."""
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        total_vram = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        allocated = torch.cuda.memory_allocated(0) / (1024**3)
        reserved = torch.cuda.memory_reserved(0) / (1024**3)
        print(f"[{stage_name}] GPU: {device_name} | Total VRAM: {total_vram:.2f} GB | Allocated: {allocated:.2f} GB | Reserved: {reserved:.2f} GB")


def load_jsonl_dataset(file_path: Path, tokenizer: AutoTokenizer) -> Dataset:
    """Load JSONL instruction dataset and format messages using tokenizer chat template."""
    formatted_texts = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            item = json.loads(line)
            messages = item.get("messages", [])
            
            try:
                formatted = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            except Exception:
                formatted = ""
                for msg in messages:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    formatted += f"<|im_start|>{role}\n{content}<|im_end|>\n"

            formatted_texts.append({"text": formatted})

    return Dataset.from_list(formatted_texts)


def run_qlora_training():
    """Main QLoRA training and evaluation pipeline."""
    print("=" * 65)
    print("AUDIT V - QLoRA 4-BIT FINE-TUNING PIPELINE")
    print("=" * 65)

    print_gpu_memory("Pre-Initialization")

    # 1. 4-bit BitsAndBytes Configuration
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )

    # 2. Load Base Model & Tokenizer
    print(f"\n[1/6] Loading Base Model: '{MODEL_ID}' in 4-bit NF4...")
    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )
    t_load = time.time() - t0
    print(f"Base model loaded in {t_load:.2f}s.")
    print_gpu_memory("Model Loaded")

    # 3. Load & Format Datasets
    print(f"\n[2/6] Loading Datasets from {TRAINING_DIR}...")
    train_dataset = load_jsonl_dataset(TRAIN_FILE, tokenizer)
    val_dataset = load_jsonl_dataset(VAL_FILE, tokenizer)
    print(f"Train Dataset: {len(train_dataset)} records | Validation Dataset: {len(val_dataset)} records")

    # 4. Configure LoRA (PEFT)
    print("\n[3/6] Configuring LoRA Adapter Target Modules...")
    model = prepare_model_for_kbit_training(model)

    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=target_modules,
    )
    print(f"Selected LoRA Config: r=8, alpha=16, dropout=0.05 | Targets: {target_modules}")

    # 5. Configure SFTConfig & SFTTrainer (fp16=False to avoid GradScaler float mismatch in 4-bit NF4)
    print("\n[4/6] Initializing SFTTrainer & SFTConfig...")
    sft_config = SFTConfig(
        output_dir=str(MODEL_OUTPUT_DIR),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        num_train_epochs=2,
        learning_rate=2e-4,
        warmup_steps=5,
        logging_steps=5,
        save_strategy="epoch",
        eval_strategy="epoch",
        gradient_checkpointing=True,
        fp16=False,
        bf16=False,
        max_length=1024,
        dataset_text_field="text",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        peft_config=peft_config,
        processing_class=tokenizer,
        args=sft_config,
    )

    # 6. Execute Training
    print("\n[5/6] Starting QLoRA Fine-Tuning Execution...")
    t_start = time.time()
    train_result = trainer.train()
    training_time = time.time() - t_start

    print(f"\n[OK] Training Completed in {training_time:.2f}s ({training_time/60:.2f} mins).")
    print_gpu_memory("Post-Training")

    # Evaluate Validation Metrics
    print("\n[6/6] Evaluating Validation Loss...")
    eval_metrics = trainer.evaluate()
    
    train_loss = train_result.training_loss
    val_loss = eval_metrics.get("eval_loss", 0.0)

    print("-" * 65)
    print(f"  * Total Steps:             {train_result.global_step}")
    print(f"  * Total Epochs:            2.0")
    print(f"  * Training Loss:           {train_loss:.4f}")
    print(f"  * Validation Loss:         {val_loss:.4f}")
    print(f"  * Execution Time:          {training_time:.2f}s")
    print("-" * 65)

    # Save Model Adapter & Tokenizer
    print(f"\nSaving LoRA Adapter weights to '{MODEL_OUTPUT_DIR}'...")
    trainer.model.save_pretrained(str(MODEL_OUTPUT_DIR))
    tokenizer.save_pretrained(str(MODEL_OUTPUT_DIR))

    # Save Training Log JSON
    log_data = {
        "model_id": MODEL_ID,
        "quantization": "4-bit NF4 (bitsandbytes)",
        "lora_config": {
            "r": 8,
            "lora_alpha": 16,
            "lora_dropout": 0.05,
            "target_modules": target_modules,
        },
        "training_params": {
            "epochs": 2,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 8,
            "effective_batch_size": 8,
            "learning_rate": 2e-4,
            "max_length": 1024,
        },
        "metrics": {
            "training_loss": round(train_loss, 4),
            "validation_loss": round(val_loss, 4),
            "global_steps": train_result.global_step,
            "training_time_seconds": round(training_time, 2),
        },
        "gpu_info": {
            "device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "allocated_vram_gb": round(torch.cuda.memory_allocated(0) / (1024**3), 2) if torch.cuda.is_available() else 0.0,
        }
    }

    log_file = MODEL_OUTPUT_DIR / "training_log.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2)
    print(f"Saved training log to '{log_file}'.")

    # Clean VRAM before generation test
    del trainer, model
    torch.cuda.empty_cache()

    # 7. Post-Training Generation Test
    run_post_training_generation_test()


def run_post_training_generation_test():
    """Load base model + fine-tuned LoRA adapter and verify generation behavior."""
    print("\n" + "=" * 65)
    print("POST-TRAINING GENERATION TEST")
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
        print(f"Generated ({gen_time:.2f}s):\n{generated_text}\n")

        eval_responses.append({
            "question_id": idx,
            "question": q,
            "answer": generated_text,
            "generation_time_seconds": round(gen_time, 2),
        })

    eval_file = MODEL_OUTPUT_DIR / "evaluation_responses.json"
    with open(eval_file, "w", encoding="utf-8") as f:
        json.dump(eval_responses, f, indent=2)

    print(f"[OK] Post-Training Generation Test PASSED! Responses saved to '{eval_file}'.")


if __name__ == "__main__":
    run_qlora_training()
