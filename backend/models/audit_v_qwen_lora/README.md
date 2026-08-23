---
license: apache-2.0
base_model: Qwen/Qwen2.5-3B-Instruct
library_name: peft
pipeline_tag: text-generation
tags:
- finance
- tax
- indian-tax
- gst
- qlora
- peft
- audit-v
---

# Audit V — Qwen2.5 3B Instruct QLoRA Adapter

**Audit V** is an AI-powered financial, taxation, and audit intelligence platform. This repository contains the official 4-bit QLoRA PEFT adapter fine-tuned on the **Audit V Indian Financial & Tax Instruction Dataset**.

- **Repository**: [peterrs23/audit-v-qwen-3b](https://huggingface.co/peterrs23/audit-v-qwen-3b)
- **Base Model**: `Qwen/Qwen2.5-3B-Instruct`
- **Developer**: Audit V AI Engineering Team

---

## 📌 Model Overview & Purpose

This LoRA adapter enhances `Qwen/Qwen2.5-3B-Instruct` with domain-specific knowledge of:
1. **Indian Income Tax Act 1961**: Section 80C, 80D, 80CCD, 10(13A) HRA, Standard Deduction, Section 115BAC (Old vs. New Tax Regimes), Section 87A Rebate, and Tax Slabs.
2. **Goods and Services Tax (GST)**: Input Tax Credit (ITC), Section 17(5) Blocked Credits, Composition Scheme, GSTR-1, and GSTR-3B compliance.
3. **Financial Advisory & Budgeting**: Fixed Deposits, 50/30/20 budgeting rule, portfolio diversification, CTC vs Take-Home breakdowns.
4. **Responsible Communication**: Stating assumptions, identifying missing user details, and enforcing system safety boundaries.

---

## 📊 Fine-Tuning & Evaluation Metrics

| Parameter | Value |
| :--- | :--- |
| **Base Model** | `Qwen/Qwen2.5-3B-Instruct` |
| **Quantization** | **4-bit NF4** (`bitsandbytes`) |
| **PEFT Method** | **QLoRA** ($r=8$, $\alpha=16$, dropout=$0.05$, bias=`none`) |
| **Target Modules** | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` |
| **Dataset Size** | **253 ChatML Q&A examples** (202 train / 51 validation, zero data leakage) |
| **Training Hyperparameters** | Epochs = `2`, Batch Size = `1`, Grad Accumulation = `8`, Learning Rate = `2e-4`, Max Length = `1024` |
| **Hardware Used** | NVIDIA GeForce RTX 4050 Laptop GPU (6GB VRAM) |
| **Peak VRAM Allocated** | **2.61 GB** / 6.00 GB |
| **Training Duration** | **596.07 seconds** (9.93 minutes) |
| **Final Training Loss** | **`1.2388`** |
| **Final Validation Loss** | **`0.6851`** |
| **Benchmark Generation Test** | **PASS** |

---

## 💻 Quickstart Usage Code

```python
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER_ID = "peterrs23/audit-v-qwen-3b"

# Configure 4-bit NF4 Quantization
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float16,
)

# Load Tokenizer & Base Model
tokenizer = AutoTokenizer.from_pretrained(ADAPTER_ID, trust_remote_code=True)
base_model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)

# Load Fine-Tuned Audit V LoRA Adapter
model = PeftModel.from_pretrained(base_model, ADAPTER_ID)
model.eval()

# Sample Query
messages = [
    {"role": "system", "content": "You are Audit V, an AI financial and tax intelligence assistant."},
    {"role": "user", "content": "What is the maximum deduction allowed under Section 80C?"}
]

prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(prompt, return_tensors="pt").to("cuda")

with torch.no_grad():
    outputs = model.generate(**inputs, max_new_tokens=200, temperature=0.7)

response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
print(response)
```

---

## ⚠️ Important Limitations & Disclaimers

1. **Adapter Dependency**: This repository contains a PEFT LoRA adapter, not a standalone model. It must be loaded on top of `Qwen/Qwen2.5-3B-Instruct`.
2. **Deterministic Calculation Boundary**: The model does **not** replace Audit V's deterministic Indian Tax Engine for exact tax liability calculations. In production, exact calculations are handled by the tax API, while the LLM provides explanations.
3. **Retrieval Integration**: In production, this model should be coupled with a RAG vector database (e.g., ChromaDB) for real-time authoritative legal references.
4. **Legal & Financial Disclaimer**: This model is built for educational and informational assistant workflows. It does not act as a certified Chartered Accountant or legal tax filing authority.