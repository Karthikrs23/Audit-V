import urllib.request
import json

base_url = "http://127.0.0.1:8000"

def test_endpoint(name, path, method="POST", payload=None):
    url = f"{base_url}{path}"
    headers = {"Content-Type": "application/json"} if payload else {}
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            print(f"PASS | {name} ({path}) -> Status {resp.status}")
            return True, body
    except Exception as e:
        print(f"FAIL | {name} ({path}) -> Error: {e}")
        return False, str(e)

print("Verifying core Audit V endpoints...")
# 1. Tax calculate
test_endpoint("Tax Calculate", "/api/v1/tax/calculate", "POST", {
    "annual_income": 1200000,
    "age": 30,
    "regime": "compare",
    "is_salaried": True,
    "deductions": {"section_80c": 150000, "section_80d": 25000}
})

# 2. Voice intent
test_endpoint("Voice Intent", "/api/v1/assistant/voice-intent", "POST", {
    "text": "Calculate tax for 12 lakh income"
})

# 3. Risk analyze
test_endpoint("Risk Analyze", "/api/v1/risk/analyze", "POST", {
    "gross_total_income": 1500000,
    "total_deductions_claimed": 250000,
    "exempt_income_claimed": 50000,
    "tds_claimed": 120000,
    "tds_26as_actual": 120000,
    "foreign_income": 0,
    "turnover_reported": 0,
    "cash_deposits": 100000,
    "high_value_transactions": 0,
    "reported_gross_income": 1500000,
    "reported_deductions": 250000,
    "tax_paid_26as": 120000,
    "tax_payable": 120000,
    "has_foreign_assets": False,
    "salary_component_ratio": 0.85,
    "business_turnover": 0,
    "cash_deposits_savings": 100000,
    "audit_required": False
})

# 4. Risk taxpayer
test_endpoint("Risk Taxpayer", "/api/v1/risk/taxpayer", "POST", {
    "taxpayer_id": "TAX-12345",
    "revenue": 5000000.0,
    "expenses": 3200000.0,
    "tax_liability": 450000.0,
    "tax_paid": 450000.0,
    "late_filings": 0,
    "compliance_violations": 0,
    "industry": "Finance",
    "audit_findings": 0
})

# 5. Market quotes
test_endpoint("Market Quotes", "/api/v1/market/quotes", "GET")

# 6. Investment guidance
test_endpoint("Investment Guidance", "/api/v1/investments/guidance", "POST", {
    "risk_profile": "moderate",
    "annual_income": 1200000,
    "current_taxable_income": 1050000,
    "preferred_regime": "new"
})
