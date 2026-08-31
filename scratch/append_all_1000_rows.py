import sys
from pathlib import Path

csv_content = """Taxpayer_ID,Revenue,Expenses,Tax_Liability,Tax_Paid,Late_Filings,Compliance_Violations,Industry,Profit,Tax_Compliance_Ratio,Audit_Findings,Audit_to_Tax_Ratio,Risk_Label
1,1149014.25,979871.09,39872.33,28921.92,2,1,Finance,169143.16000000003,0.73,0,0.0,High
2,958520.71,884926.74,47832.22,39396.15,1,1,Retail,73593.96999999997,0.82,0,0.0,Medium
3,1194306.56,711926.07,38113.7,43863.94,4,0,Manufacturing,482380.4900000001,1.15,3,0.0,High
4,1456908.96,570612.64,45380.58,66876.88,4,2,Finance,886296.32,1.47,1,0.0,High
5,929753.99,839644.66,21595.78,53565.53,0,0,Tech,90109.32999999996,2.48,2,0.0,Low
6,929758.91,778697.08,53199.41,34645.18,0,2,Manufacturing,151061.83000000007,0.65,8,0.0,High
7,1473763.84,879038.64,50018.08,52860.36,2,0,Healthcare,594725.2000000001,1.06,1,0.0,Medium
8,1230230.42,827034.36,37743.67,32526.96,1,2,Finance,403196.05999999994,0.86,3,0.0,High
9,859157.68,909910.54,59888.69,58826.91,3,0,Healthcare,-50752.859999999986,0.98,0,0.0,High
10,1162768.01,592952.96,64063.55,43288.75,0,2,Healthcare,569815.05,0.68,1,0.0,High
"""

target_path = Path("C:/Audit-V/datasets/financial/taxpayer_risk_dataset.csv")

backend_dir = Path("C:/Audit-V/backend").resolve()
sys.path.insert(0, str(backend_dir))

from app.ml.taxpayer_risk_model import TaxpayerRiskModel
model = TaxpayerRiskModel()
res = model.train_from_csv(target_path)
print("[SUCCESS]", res)
