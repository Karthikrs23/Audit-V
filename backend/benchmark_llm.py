#!/usr/bin/env python3
"""AUDIT V — Isolated LLM GPU Benchmark Suite.

Measures raw fine-tuned Qwen2.5-3B-Instruct + LoRA generation speed without:
- FastAPI / REST API
- RAG retrieval
- SSE / WebSockets
- Frontend / Network
- Serialization overhead

Measures:
1. CUDA Availability & GPU Name
2. Model & Input Tensor Device placement
3. Initial & Generation Peak VRAM Usage
4. Time to First Token (TTFT)
5. Generated Token Count
6. Total Generation Time
7. Sustained Tokens per Second
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


def run_benchmark(
    load_in_4bit: bool = True,
    load_in_8bit: bool = False,
    compute_dtype_str: str = "bfloat16",
    use_double_quant: bool = False,
    device_map_str: str = "auto",
    merge_adapter: bool = False,
    max_new_tokens: int = 128,
    prompt_text: str = "Explain Section 80C tax deductions under the Indian Income Tax Act in detail.",
):
    print("=" * 80)
    print("AUDIT V ISOLATED GPU BENCHMARK")
    print("=" * 80)

    cuda_available = torch.cuda.is_available()
    print(f"[BENCHMARK] CUDA Available: {cuda_available}")
    if not cuda_available:
        print("[BENCHMARK] ERROR: CUDA is required for this GPU benchmark.")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    print(f"[BENCHMARK] GPU Name: {gpu_name}")

    from app.core.config import get_settings
    settings = get_settings()
    local_adapter_path = backend_dir / "models" / "audit_v_qwen_lora"
    adapter_source = str(local_adapter_path) if local_adapter_path.exists() else settings.HF_ADAPTER_REPO

    print(f"[BENCHMARK] Base Model: {settings.HF_MODEL_NAME}")
    print(f"[BENCHMARK] Adapter Source: {adapter_source}")
    print(f"[BENCHMARK] Config: 4bit={load_in_4bit}, 8bit={load_in_8bit}, compute_dtype={compute_dtype_str}, double_quant={use_double_quant}, device_map={device_map_str}")

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    vram_before = torch.cuda.memory_allocated(0) / (1024**3)
    print(f"[BENCHMARK] VRAM Allocated Before Load: {vram_before:.3f} GB")

    t_load_start = time.time()

    compute_dtype = getattr(torch, compute_dtype_str, torch.bfloat16)

    tokenizer = AutoTokenizer.from_pretrained(adapter_source, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    if load_in_4bit:
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=use_double_quant,
            bnb_4bit_compute_dtype=compute_dtype,
        )
        base_model = AutoModelForCausalLM.from_pretrained(
            settings.HF_MODEL_NAME,
            quantization_config=bnb_config,
            device_map=device_map_str if device_map_str != "cuda:0" else {"": 0},
            attn_implementation="sdpa",
            trust_remote_code=True,
        )
    elif load_in_8bit:
        bnb_config = BitsAndBytesConfig(load_in_8bit=True)
        base_model = AutoModelForCausalLM.from_pretrained(
            settings.HF_MODEL_NAME,
            quantization_config=bnb_config,
            device_map=device_map_str if device_map_str != "cuda:0" else {"": 0},
            attn_implementation="sdpa",
            trust_remote_code=True,
        )
    else:
        # Native 16-bit (bfloat16 or float16)
        base_model = AutoModelForCausalLM.from_pretrained(
            settings.HF_MODEL_NAME,
            torch_dtype=compute_dtype,
            device_map=device_map_str if device_map_str != "cuda:0" else {"": 0},
            attn_implementation="sdpa",
            trust_remote_code=True,
        )

    model = PeftModel.from_pretrained(base_model, adapter_source)
    if merge_adapter and not (load_in_4bit or load_in_8bit):
        print("[BENCHMARK] Merging LoRA adapter into base model...")
        model = model.merge_and_unload()

    model.eval()
    t_load_end = time.time()

    vram_after_load = torch.cuda.memory_allocated(0) / (1024**3)
    print(f"[BENCHMARK] Model Loaded in: {t_load_end - t_load_start:.2f}s")
    print(f"[BENCHMARK] VRAM Allocated After Load: {vram_after_load:.3f} GB")

    first_param_dev = next(model.parameters()).device
    first_param_dtype = next(model.parameters()).dtype
    print(f"[BENCHMARK] Model Parameter Device: {first_param_dev}")
    print(f"[BENCHMARK] Model Parameter Dtype: {first_param_dtype}")

    # Build Prompt
    messages = [
        {"role": "system", "content": "You are Audit V financial assistant."},
        {"role": "user", "content": prompt_text},
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")

    target_device = first_param_dev if first_param_dev.type == "cuda" else torch.device("cuda:0")
    inputs = inputs.to(target_device)

    print(f"[BENCHMARK] input_ids Device: {inputs.input_ids.device}")
    print(f"[BENCHMARK] attention_mask Device: {inputs.attention_mask.device}")

    # Warmup Run
    print("[BENCHMARK] Running Warmup Generation (10 tokens)...")
    with torch.inference_mode():
        _ = model.generate(
            **inputs,
            max_new_tokens=10,
            do_sample=False,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Actual Timed Benchmark Run
    print(f"[BENCHMARK] Running Main Generation Benchmark ({max_new_tokens} max tokens)...")
    torch.cuda.synchronize()
    t_start = time.perf_counter()

    ttft = 0.0
    output_tokens_count = 0

    with torch.inference_mode():
        # First-token time capture
        out_first = model.generate(
            **inputs,
            max_new_tokens=1,
            do_sample=False,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )
        torch.cuda.synchronize()
        t_first = time.perf_counter()
        ttft = t_first - t_start

        # Remaining tokens generation
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )
        torch.cuda.synchronize()
        t_end = time.perf_counter()

    vram_peak = torch.cuda.max_memory_allocated(0) / (1024**3)
    total_gen_time = t_end - t_start
    input_len = inputs.input_ids.shape[1]
    total_len = output_ids.shape[1]
    output_tokens_count = total_len - input_len

    sustained_gen_time = t_end - t_first
    sustained_tokens = max(1, output_tokens_count - 1)
    tokens_per_sec = output_tokens_count / total_gen_time if total_gen_time > 0 else 0
    sustained_tokens_per_sec = sustained_tokens / sustained_gen_time if sustained_gen_time > 0 else 0

    decoded_text = tokenizer.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()

    print("\n" + "=" * 80)
    print("BENCHMARK RESULTS")
    print("=" * 80)
    print(f"CUDA Available            : {cuda_available}")
    print(f"GPU Name                  : {gpu_name}")
    print(f"Model Device              : {first_param_dev}")
    print(f"Input Tensor Device       : {inputs.input_ids.device}")
    print(f"VRAM Allocated (Load)     : {vram_after_load:.3f} GB")
    print(f"VRAM Peak (Generation)    : {vram_peak:.3f} GB")
    print(f"Prompt Tokens             : {input_len}")
    print(f"Generated Tokens          : {output_tokens_count}")
    print(f"Time to First Token (TTFT): {ttft:.4f} s")
    print(f"Total Generation Time     : {total_gen_time:.3f} s")
    print(f"Overall Tokens/Sec        : {tokens_per_sec:.2f} tok/s")
    print(f"Sustained Tokens/Sec      : {sustained_tokens_per_sec:.2f} tok/s")
    print("-" * 80)
    safe_text = decoded_text[:200].encode("ascii", errors="replace").decode("ascii")
    print(f"Generated Sample Snippet:\n{safe_text}...")
    print("=" * 80 + "\n")

    return {
        "ttft": ttft,
        "tokens_per_sec": tokens_per_sec,
        "sustained_tokens_per_sec": sustained_tokens_per_sec,
        "vram_peak": vram_peak,
        "output_tokens": output_tokens_count,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit V LLM Isolated GPU Benchmark")
    parser.add_argument("--eightbit", "--8bit", dest="eightbit", action="store_true", help="Load in 8-bit quantization")
    parser.add_argument("--sixteenbit", "--16bit", dest="sixteenbit", action="store_true", help="Load in native 16-bit precision (no quantization)")
    parser.add_argument("--dtype", type=str, default="bfloat16", choices=["float16", "bfloat16", "float32"])
    parser.add_argument("--double-quant", action="store_true", help="Enable double quantization in 4-bit")
    parser.add_argument("--device-map", type=str, default="auto", help="device_map setting (auto, cuda:0)")
    parser.add_argument("--tokens", type=int, default=128, help="Max new tokens to generate")
    args = parser.parse_args()

    load_4bit = not (args.eightbit or args.sixteenbit)
    run_benchmark(
        load_in_4bit=load_4bit,
        load_in_8bit=args.eightbit,
        compute_dtype_str=args.dtype,
        use_double_quant=args.double_quant,
        device_map_str=args.device_map,
        max_new_tokens=args.tokens,
    )
