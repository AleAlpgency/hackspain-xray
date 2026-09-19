"""Build a company-month panel from the Embat X-Ray dump. One pass per big file."""
import csv, collections, datetime, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output") + "/"
MAXM="2026-08"  # 2026-09 holds only day 1; drop it

def d(s): return datetime.date(int(s[:4]),int(s[5:7]),int(s[8:10]))

pan=collections.defaultdict(collections.Counter)
cps=collections.defaultdict(set)
bankprod=set(); 
for r in csv.DictReader(open(D+"banking_products.csv")): bankprod.add(r["product_id"])

for r in csv.DictReader(open(D+"transactions.csv")):
    m=r["date"][:7]
    if m>MAXM: continue
    k=(r["company_id"],m); v=pan[k]; a=float(r["amount"] or 0); cat=r["category"]
    v["n"]+=1
    if a>0: v["inflow"]+=a
    else: v["outflow"]+=-a
    if r["product_id"] in bankprod: v["bank_net"]+=a
    if cat in ("interest_charge","fee"): v["fincost"]+=-a
    if cat=="salary": v["salary"]+=-a
    if cat in ("tax","social_security"): v["tax"]+=-a
    if cat=="debt_repayment": v["debtrepay"]+=-a
    if r["counterparty_id"]: cps[k].add(r["counterparty_id"])
for k,s in cps.items(): pan[k]["ncp"]=len(s)

# invoices: issued/received by issuance month, DSO on PAID only by payment month, overdue stock by issuance month
for r in csv.DictReader(open(D+"invoices.csv")):
    c=r["company_id"]; im=r["issuance_date"][:7]
    if im<="2026-08" and im>="2024-09":
        v=pan[(c,im)]; a=float(r["amount"] or 0)
        v["inv_n"]+=1
        if a>0: v["inv_ar"]+=a
        else: v["inv_ap"]+=-a
        if r["status"]=="overdue": v["ovd_amt"]+=abs(float(r["pending_amount"] or 0)); v["ovd_n"]+=1
    if r["status"]=="paid" and r["payment_date"] and r["due_date"]:
        pm=r["payment_date"][:7]
        if "2024-09"<=pm<=MAXM:
            v=pan[(c,pm)]
            v["paid_n"]+=1
            v["dpd_sum"]+=(d(r["payment_date"])-d(r["due_date"])).days
            v["dso_sum"]+=(d(r["payment_date"])-d(r["issuance_date"])).days

# closing cash balance, reconstructed backwards from the 2026-09-01 snapshot (banking products only)
final=collections.Counter()
for r in csv.DictReader(open(D+"balances.csv")):
    if r["product_id"] in bankprod: final[r["company_id"]]+=float(r["balance"] or 0)

months=[]
y,mo=2024,9
while f"{y}-{mo:02d}"<=MAXM:
    months.append(f"{y}-{mo:02d}"); mo+=1
    if mo==13: mo=1; y+=1

cols=["company_id","month","n","inflow","outflow","bank_net","fincost","salary","tax","debtrepay",
      "ncp","inv_n","inv_ar","inv_ap","ovd_amt","ovd_n","paid_n","dpd_sum","dso_sum","cash_close"]
comps=sorted({c for c,_ in pan})
w=csv.writer(open("panel.csv","w")); w.writerow(cols)
for c in comps:
    bal=final[c]; rows=[]
    for m in reversed(months):
        v=pan.get((c,m))
        if v is None and m not in {mm for cc,mm in pan if cc==c}: pass
        v=v or collections.Counter()
        rows.append([c,m]+[v[k] for k in cols[2:-1]]+[round(bal,2)])
        bal-=v["bank_net"]          # step back one month
    for r in reversed(rows):
        w.writerow(r)
print("rows", len(comps)*len(months), "companies", len(comps))
