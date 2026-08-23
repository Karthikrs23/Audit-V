#!/usr/bin/env python3
"""Synthetic Financial Transaction Dataset Generator for Audit V.

Generates 300 realistic synthetic transactions containing 18 ground-truth anomalies
across 4 distinct anomaly categories:
1. Amount Outliers (6)
2. Duplicate Transactions (4)
3. Odd-Hour Transactions (4)
4. Suspicious Round-Number Transactions (4)
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

OUTP_PATH = Path(__file__).resolve().parents[1] / "datasets" / "financial" / "transactions_synthetic.json"
OUTP_PATH.parent.mkdir(parents=True, exist_ok=True)

CATEGORIES = {
    "Dining & Cafes": (200, 1500, ["Starbucks Coffee", "Subway", "Domino's Pizza", "Blue Tokai Coffee"]),
    "Groceries": (500, 5000, ["D-Mart Supermarket", "Reliance Fresh", "BigBasket", "Nature's Basket"]),
    "Fuel & Travel": (1500, 4500, ["Indian Oil Petrol Pump", "BPCL Station", "Uber Rides", "MakeMyTrip"]),
    "Shopping": (1200, 18000, ["Zara Retail", "H&M Apparel", "Amazon India", "Flipkart Online"]),
    "Utilities": (1000, 6000, ["Tata Power Electricity", "Mahanagar Gas", "Jio Fiber Broadband"]),
    "Electronics": (8000, 65000, ["Croma Electronics", "Reliance Digital", "Apple Store"]),
    "Professional Services": (15000, 85000, ["Legal Advisory Pvt Ltd", "Accounting Associates", "TCS Cloud Sub"]),
    "Money Transfer": (2000, 50000, ["HDFC Bank Transfer", "ICICI Direct Transfer", "Paytm Wallet"]),
}

LOCATIONS = ["Mumbai, India", "New Delhi, India", "Bengaluru, India", "Hyderabad, India", "Pune, India"]
PAYMENT_METHODS = ["UPI", "Debit Card", "Credit Card", "Net Banking", "NEFT"]


def generate_dataset() -> dict:
    transactions = []
    base_date = datetime(2024, 3, 1, 8, 0, 0)
    tx_count = 0

    # Normal Transactions Generator (282 transactions)
    for i in range(1, 283):
        tx_count += 1
        tx_id = f"TXN-{1000 + tx_count}"
        
        # Day increment
        dt = base_date + timedelta(days=(i // 10), hours=random.randint(8, 21) - 8, minutes=random.randint(0, 59), seconds=random.randint(0, 59))
        
        cat_name = random.choice(list(CATEGORIES.keys()))
        min_a, max_a, merchants = CATEGORIES[cat_name]
        amount = round(random.uniform(min_a, max_a), 2)
        merchant = random.choice(merchants)
        pay_method = random.choice(PAYMENT_METHODS)
        location = random.choice(LOCATIONS)

        transactions.append({
            "transaction_id": tx_id,
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M:%S"),
            "amount": amount,
            "transaction_type": "debit",
            "category": cat_name,
            "merchant": merchant,
            "account_type": "checking" if pay_method in ["UPI", "NEFT"] else "credit",
            "location": location,
            "payment_method": pay_method,
            "is_known_anomaly": False,
            "anomaly_type": "none"
        })

    # Deliberate Anomalies Generator (18 anomalies)
    anomalies = []

    # 1. Amount Outliers (6)
    amount_anomalies = [
        ("Dining & Cafes", "Starbucks Coffee", 485000.00),
        ("Groceries", "D-Mart Supermarket", 750000.00),
        ("Fuel & Travel", "Uber Rides", 920000.00),
        ("Dining & Cafes", "Subway", 390000.00),
        ("Shopping", "H&M Apparel", 850000.00),
        ("Utilities", "Mahanagar Gas", 420000.00),
    ]
    for cat, merch, amt in amount_anomalies:
        tx_count += 1
        dt = base_date + timedelta(days=random.randint(1, 25), hours=random.randint(10, 18), minutes=random.randint(0, 59))
        anomalies.append({
            "transaction_id": f"TXN-{1000 + tx_count}",
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M:%S"),
            "amount": amt,
            "transaction_type": "debit",
            "category": cat,
            "merchant": merch,
            "account_type": "checking",
            "location": random.choice(LOCATIONS),
            "payment_method": "UPI",
            "is_known_anomaly": True,
            "anomaly_type": "amount_outlier"
        })

    # 2. Duplicate Transactions (4)
    normal_targets = random.sample(transactions[:50], 4)
    for target in normal_targets:
        tx_count += 1
        target_dt = datetime.strptime(f"{target['date']} {target['time']}", "%Y-%m-%d %H:%M:%S")
        dup_dt = target_dt + timedelta(seconds=random.randint(15, 75))
        anomalies.append({
            "transaction_id": f"TXN-{1000 + tx_count}",
            "date": dup_dt.strftime("%Y-%m-%d"),
            "time": dup_dt.strftime("%H:%M:%S"),
            "amount": target["amount"],
            "transaction_type": target["transaction_type"],
            "category": target["category"],
            "merchant": target["merchant"],
            "account_type": target["account_type"],
            "location": target["location"],
            "payment_method": target["payment_method"],
            "is_known_anomaly": True,
            "anomaly_type": "duplicate"
        })

    # 3. Odd-Hour High-Value Transactions (4)
    odd_hour_targets = [
        ("Money Transfer", "Unknown Overseas Corp", 280000.00, "03:14:22"),
        ("Electronics", "Unverified Merchant X", 340000.00, "02:45:10"),
        ("Money Transfer", "Offshore Capital Ltd", 410000.00, "04:12:05"),
        ("Shopping", "Luxury Watch Dealer", 295000.00, "03:50:40"),
    ]
    for cat, merch, amt, t_str in odd_hour_targets:
        tx_count += 1
        dt_day = (base_date + timedelta(days=random.randint(1, 25))).strftime("%Y-%m-%d")
        anomalies.append({
            "transaction_id": f"TXN-{1000 + tx_count}",
            "date": dt_day,
            "time": t_str,
            "amount": amt,
            "transaction_type": "debit",
            "category": cat,
            "merchant": merch,
            "account_type": "checking",
            "location": random.choice(LOCATIONS),
            "payment_method": "Wire Transfer",
            "is_known_anomaly": True,
            "anomaly_type": "odd_hour"
        })

    # 4. Suspicious Round-Number Transactions (4)
    round_targets = [
        ("Professional Services", "Apex Consulting Pvt Ltd", 500000.00),
        ("Money Transfer", "Global Trade Advisory", 1000000.00),
        ("Professional Services", "Nexus Advisory Services", 700000.00),
        ("Money Transfer", "Capital Holdings India", 250000.00),
    ]
    for cat, merch, amt in round_targets:
        tx_count += 1
        dt = base_date + timedelta(days=random.randint(1, 25), hours=random.randint(11, 16), minutes=0, seconds=0)
        anomalies.append({
            "transaction_id": f"TXN-{1000 + tx_count}",
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M:%S"),
            "amount": amt,
            "transaction_type": "debit",
            "category": cat,
            "merchant": merch,
            "account_type": "checking",
            "location": random.choice(LOCATIONS),
            "payment_method": "NEFT",
            "is_known_anomaly": True,
            "anomaly_type": "round_number"
        })

    # Combine all transactions and sort chronologically
    all_transactions = transactions + anomalies
    all_transactions.sort(key=lambda x: f"{x['date']} {x['time']}")

    dataset = {
        "metadata": {
            "dataset_name": "Audit V Synthetic Financial Transaction Dataset",
            "purpose": "SYNTHETIC / DEMONSTRATION DATA FOR ANOMALY DETECTION DEVELOPMENT",
            "disclaimer": "This dataset contains purely synthetic financial transactions generated for development and testing of anomaly detection algorithms. It does not represent real customer financial data.",
            "total_transactions": len(all_transactions),
            "known_anomalies_count": len(anomalies),
            "anomaly_categories": {
                "amount_outlier": 6,
                "duplicate": 4,
                "odd_hour": 4,
                "round_number": 4
            }
        },
        "transactions": all_transactions
    }

    return dataset


if __name__ == "__main__":
    ds = generate_dataset()
    with open(OUTP_PATH, "w", encoding="utf-8") as f:
        json.dump(ds, f, indent=2)

    print(f"Generated {ds['metadata']['total_transactions']} synthetic transactions into {OUTP_PATH}")
    print(f"  * Ground Truth Anomalies: {ds['metadata']['known_anomalies_count']}")
    for k, v in ds['metadata']['anomaly_categories'].items():
        print(f"    - {k}: {v}")
