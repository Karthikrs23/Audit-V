from __future__ import annotations

from typing import Any, Dict, List


def generate_risk_summary_text(
    total_transactions: int,
    anomalies_count: int,
    risk_summary: Dict[str, int],
    top_anomalies: List[Dict[str, Any]],
) -> str:
    """Generate a clean, structured natural language summary of transaction risk findings."""
    critical_cnt = risk_summary.get("critical", 0)
    high_cnt = risk_summary.get("high", 0)
    medium_cnt = risk_summary.get("medium", 0)
    low_cnt = risk_summary.get("low", 0)

    summary_text = (
        f"**Audit V Transaction Risk & Anomaly Assessment Summary**\n\n"
        f"Analyzed **{total_transactions}** financial transactions. Identified **{anomalies_count}** potential anomalies requiring review:\n"
        f"• **Critical Risk Alerts**: {critical_cnt}\n"
        f"• **High Risk Alerts**: {high_cnt}\n"
        f"• **Medium Risk Warnings**: {medium_cnt}\n"
        f"• **Low Risk Normal Activity**: {low_cnt}\n\n"
    )

    if top_anomalies:
        summary_text += "**Key Suspicious Findings**:\n"
        for idx, tx in enumerate(top_anomalies[:4], 1):
            tx_id = tx.get("transaction_id", "")
            amt = float(tx.get("amount", 0.0))
            merch = tx.get("merchant", "")
            reason = tx.get("primary_reason", "Suspicious transaction pattern.")
            risk = tx.get("risk_level", "HIGH")
            summary_text += f"{idx}. **[{risk}] {tx_id}** (₹{amt:,.2f} at {merch}): {reason}\n"

    summary_text += (
        "\n*Recommendation: Investigate high and critical risk transactions before approving payouts or tax filings.*"
    )
    return summary_text
