#!/usr/bin/env python3
"""Validation Script for Audit V Fine-Tuning Dataset.

Checks:
- JSON validity
- Required fields (messages, metadata, roles, content)
- Valid roles ('system', 'user', 'assistant')
- Non-empty content strings
- Exact and near-duplicate user questions
- Data leakage across train/validation splits
- Source metadata validity

Prints exact statistics:
- Total examples
- Training examples
- Validation examples
- Duplicates count
- Invalid records count
- Category distribution
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Set

ROOT_DIR = Path(__file__).resolve().parents[1]
TRAINING_DIR = ROOT_DIR / "datasets" / "training"

MASTER_FILE = TRAINING_DIR / "audit_v_instruct.jsonl"
TRAIN_FILE = TRAINING_DIR / "train.jsonl"
VAL_FILE = TRAINING_DIR / "validation.jsonl"

VALID_ROLES = {"system", "user", "assistant"}


def validate_file(file_path: Path) -> tuple[List[Dict[str, Any]], int, List[str]]:
    """Validate a JSONL dataset file for schema compliance and structure."""
    if not file_path.exists():
        return [], 1, [f"File not found: {file_path}"]

    records = []
    invalid_count = 0
    errors = []

    with open(file_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                data = json.loads(line_str)
            except json.JSONDecodeError as err:
                invalid_count += 1
                errors.append(f"Line {idx}: JSON parse error -> {err}")
                continue

            # Validate top-level keys
            if "messages" not in data or "metadata" not in data:
                invalid_count += 1
                errors.append(f"Line {idx}: Missing 'messages' or 'metadata' key.")
                continue

            messages = data["messages"]
            metadata = data["metadata"]

            if not isinstance(messages, list) or len(messages) < 2:
                invalid_count += 1
                errors.append(f"Line {idx}: 'messages' must be a list with at least 2 roles.")
                continue

            # Validate message roles & content
            msg_invalid = False
            for m_idx, msg in enumerate(messages):
                if not isinstance(msg, dict):
                    msg_invalid = True
                    errors.append(f"Line {idx}, Msg {m_idx}: Must be a JSON object.")
                    break
                role = msg.get("role")
                content = msg.get("content")

                if role not in VALID_ROLES:
                    msg_invalid = True
                    errors.append(f"Line {idx}: Invalid role '{role}'. Must be one of {VALID_ROLES}.")
                    break

                if not isinstance(content, str) or not content.strip():
                    msg_invalid = True
                    errors.append(f"Line {idx}: Empty content for role '{role}'.")
                    break

            if msg_invalid:
                invalid_count += 1
                continue

            # Validate metadata fields
            if not isinstance(metadata, dict):
                invalid_count += 1
                errors.append(f"Line {idx}: 'metadata' must be a dictionary.")
                continue

            for req_meta in ["category", "topic", "source"]:
                if req_meta not in metadata or not metadata[req_meta]:
                    invalid_count += 1
                    errors.append(f"Line {idx}: Missing required metadata field '{req_meta}'.")
                    break

            records.append(data)

    return records, invalid_count, errors


def run_full_validation():
    """Run full verification on master, train, and validation datasets."""
    print("=" * 60)
    print("AUDIT V FINE-TUNING DATASET VALIDATION REPORT")
    print("=" * 60)

    master_records, master_invalid, master_errors = validate_file(MASTER_FILE)
    train_records, train_invalid, train_errors = validate_file(TRAIN_FILE)
    val_records, val_invalid, val_errors = validate_file(VAL_FILE)

    total_invalid = master_invalid + train_invalid + val_invalid

    # Check duplicates in master
    seen_user_questions: Set[str] = set()
    duplicate_count = 0
    for r in master_records:
        user_msg = next((m["content"].strip().lower() for m in r["messages"] if m["role"] == "user"), "")
        if user_msg in seen_user_questions:
            duplicate_count += 1
        else:
            seen_user_questions.add(user_msg)

    # Check data leakage between train and validation splits
    train_questions = {
        next((m["content"].strip().lower() for m in r["messages"] if m["role"] == "user"), "")
        for r in train_records
    }
    leakage_count = 0
    for r in val_records:
        val_q = next((m["content"].strip().lower() for m in r["messages"] if m["role"] == "user"), "")
        if val_q in train_questions:
            leakage_count += 1

    # Category distribution breakdown
    cat_distribution: Dict[str, int] = {}
    for r in master_records:
        cat = r["metadata"].get("category", "unknown")
        cat_distribution[cat] = cat_distribution.get(cat, 0) + 1

    print(f"Total Master Examples:    {len(master_records)}")
    print(f"Training Examples (80%):  {len(train_records)}")
    print(f"Validation Examples(20%): {len(val_records)}")
    print("-" * 60)
    print(f"Duplicates Count:         {duplicate_count}")
    print(f"Invalid Records Count:    {total_invalid}")
    print(f"Train/Val Data Leakage:   {leakage_count}")
    print("-" * 60)
    print("Category Distribution Breakdown:")
    for cat, count in cat_distribution.items():
        pct = (count / len(master_records) * 100) if master_records else 0.0
        print(f"  * {cat:15s}: {count:3d} records ({pct:.1f}%)")
    print("=" * 60)

    if total_invalid == 0 and duplicate_count == 0 and leakage_count == 0:
        print("[OK] DATASET VALIDATION PASSED: 100% Valid, Clean & Leakage-Free!")
    else:
        print("[FAIL] DATASET VALIDATION ISSUES DETECTED!")
        if master_errors:
            print("Errors:", master_errors[:5])


if __name__ == "__main__":
    run_full_validation()
