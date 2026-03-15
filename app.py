from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ── Load & preprocess ─────────────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "ecommerce_product_dataset.csv")
df_raw = pd.read_csv(DATA_PATH, encoding="latin1")

# Parse dates
df_raw["Date"]  = pd.to_datetime(df_raw["DateAdded"])
df_raw["Year"]  = df_raw["Date"].dt.year
df_raw["Month"] = df_raw["Date"].dt.month
df_raw["YearMonth"] = df_raw["Date"].dt.to_period("M").astype(str)

# Derived financials
# Revenue = units sold × price;  Profit = Revenue × (margin after discount & ~40% COGS)
df_raw["Revenue"]    = (df_raw["Price"] * df_raw["Sales"]).round(2)
df_raw["Profit"]     = (df_raw["Revenue"] * (1 - df_raw["Discount"] - 0.40)).round(2)
df_raw["Margin_Pct"] = ((df_raw["Profit"] / df_raw["Revenue"]) * 100).round(2)

ALL_YEARS      = sorted(df_raw["Year"].unique().tolist())
ALL_CATEGORIES = sorted(df_raw["Category"].unique().tolist())


def apply_filters(df):
    year     = request.args.get("year")
    category = request.args.get("category")
    if year     and year     != "all": df = df[df["Year"]     == int(year)]
    if category and category != "all": df = df[df["Category"] == category]
    return df


def compute_kpis(df):
    rev    = float(df["Revenue"].sum())
    profit = float(df["Profit"].sum())
    units  = int(df["Sales"].sum())
    prods  = int(df["ProductID"].nunique())
    margin = (profit / rev * 100) if rev else 0
    avg_price = float(df["Price"].mean())
    avg_rating = float(df["Rating"].mean())
    avg_disc   = float(df["Discount"].mean()) * 100
    return dict(revenue=rev, profit=profit, units=units, products=prods,
                profit_margin=round(margin, 2), avg_price=round(avg_price, 2),
                avg_rating=round(avg_rating, 2), avg_discount=round(avg_disc, 2))


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html",
                           years=ALL_YEARS,
                           categories=ALL_CATEGORIES)


@app.route("/api/filters")
def get_filters():
    return jsonify(years=ALL_YEARS, categories=ALL_CATEGORIES)


# ── KPIs + YoY ─────────────────────────────────────────────────────────────────
@app.route("/api/kpis")
def api_kpis():
    df  = apply_filters(df_raw.copy())
    cur = compute_kpis(df)
    yoy = {}

    year_param = request.args.get("year")
    if year_param and year_param != "all":
        cur_y  = int(year_param)
        df_prev = df_raw[df_raw["Year"] == cur_y - 1].copy()
        cat = request.args.get("category")
        if cat and cat != "all": df_prev = df_prev[df_prev["Category"] == cat]
        prev = compute_kpis(df_prev)
        for k in ["revenue", "profit", "units", "products", "profit_margin", "avg_price", "avg_rating"]:
            p = prev[k]; c = cur[k]
            yoy[k] = round((c - p) / abs(p) * 100, 1) if p else None
    else:
        years_in = sorted(df["Year"].unique())
        if len(years_in) >= 2:
            prev = compute_kpis(df[df["Year"] == years_in[-2]])
            this = compute_kpis(df[df["Year"] == years_in[-1]])
            for k in ["revenue", "profit", "units", "products", "profit_margin", "avg_price", "avg_rating"]:
                p = prev[k]; c = this[k]
                yoy[k] = round((c - p) / abs(p) * 100, 1) if p else None

    return jsonify(kpis=cur, yoy=yoy)


# ── YoY bar chart ──────────────────────────────────────────────────────────────
@app.route("/api/yoy")
def api_yoy():
    df = apply_filters(df_raw.copy())
    yoy = (df.groupby("Year")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Units=("Sales","sum"), Products=("ProductID","nunique"))
             .reset_index())
    yoy["Margin"] = (yoy["Profit"] / yoy["Revenue"] * 100).round(2)
    return jsonify(
        years=yoy["Year"].tolist(),
        revenue=yoy["Revenue"].round(2).tolist(),
        profit=yoy["Profit"].round(2).tolist(),
        units=yoy["Units"].tolist(),
        margin=yoy["Margin"].tolist()
    )


# ── Monthly revenue trend ──────────────────────────────────────────────────────
@app.route("/api/sales-trend")
def api_sales_trend():
    df = apply_filters(df_raw.copy())
    trend = (df.groupby("YearMonth")
               .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                    Units=("Sales","sum"))
               .reset_index().sort_values("YearMonth"))
    return jsonify(
        labels=trend["YearMonth"].tolist(),
        sales=trend["Revenue"].round(2).tolist(),
        profit=trend["Profit"].round(2).tolist(),
        orders=trend["Units"].tolist()
    )


# ── Category breakdown ─────────────────────────────────────────────────────────
@app.route("/api/category")
def api_category():
    df = apply_filters(df_raw.copy())
    cat = (df.groupby("Category")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Units=("Sales","sum"), Products=("ProductID","nunique"))
             .reset_index())
    cat["Margin"] = (cat["Profit"] / cat["Revenue"] * 100).round(2)
    return jsonify(
        labels=cat["Category"].tolist(),
        sales=cat["Revenue"].round(2).tolist(),
        profit=cat["Profit"].round(2).tolist(),
        quantity=cat["Units"].tolist(),
        margin=cat["Margin"].tolist()
    )


# ── Sub-category → Top product names grouped ───────────────────────────────────
@app.route("/api/subcategory")
def api_subcategory():
    df = apply_filters(df_raw.copy())
    sub = (df.groupby("ProductName")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Units=("Sales","sum"))
             .reset_index()
             .sort_values("Profit", ascending=True)
             .head(17))
    sub["Margin"] = (sub["Profit"] / sub["Revenue"] * 100).round(2)
    sub["ProductName"] = sub["ProductName"].str[:30]
    return jsonify(
        labels=sub["ProductName"].tolist(),
        sales=sub["Revenue"].round(2).tolist(),
        profit=sub["Profit"].round(2).tolist(),
        quantity=sub["Units"].tolist(),
        margin=sub["Margin"].tolist()
    )


# ── Region → City breakdown ────────────────────────────────────────────────────
@app.route("/api/region")
def api_region():
    df = apply_filters(df_raw.copy())
    reg = (df.groupby("Category")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Units=("Sales","sum"), Products=("ProductID","nunique"))
             .reset_index())
    reg["Margin"] = (reg["Profit"] / reg["Revenue"] * 100).round(2)
    return jsonify(
        labels=reg["Category"].tolist(),
        sales=reg["Revenue"].round(2).tolist(),
        profit=reg["Profit"].round(2).tolist(),
        orders=reg["Units"].tolist(),
        customers=reg["Products"].tolist(),
        margin=reg["Margin"].tolist()
    )


# ── Top cities by revenue ──────────────────────────────────────────────────────
@app.route("/api/state")
def api_state():
    df = apply_filters(df_raw.copy())
    top_n = int(request.args.get("n", 15))
    st = (df.groupby("City")
            .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"))
            .reset_index()
            .sort_values("Revenue", ascending=False)
            .head(top_n))
    st["Margin"] = (st["Profit"] / st["Revenue"] * 100).round(2)
    return jsonify(
        labels=st["City"].tolist(),
        sales=st["Revenue"].round(2).tolist(),
        profit=st["Profit"].round(2).tolist(),
        margin=st["Margin"].tolist()
    )


# ── Segment → Rating tier ──────────────────────────────────────────────────────
@app.route("/api/segment")
def api_segment():
    df = apply_filters(df_raw.copy())

    def rating_tier(r):
        if r >= 4.0: return "High (4-5★)"
        elif r >= 3.0: return "Mid (3-4★)"
        return "Low (<3★)"

    df["RatingTier"] = df["Rating"].apply(rating_tier)
    seg = (df.groupby("RatingTier")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Products=("ProductID","nunique"), Units=("Sales","sum"))
             .reset_index())
    seg["Margin"] = (seg["Profit"] / seg["Revenue"] * 100).round(2)
    seg["AOV"]    = (seg["Revenue"] / seg["Products"]).round(2)
    seg["Revenue per Customer"] = seg["AOV"]
    return jsonify(
        labels=seg["RatingTier"].tolist(),
        sales=seg["Revenue"].round(2).tolist(),
        profit=seg["Profit"].round(2).tolist(),
        orders=seg["Products"].tolist(),
        customers=seg["Products"].tolist(),
        margin=seg["Margin"].tolist(),
        aov=seg["AOV"].tolist(),
        revenue_per_customer=seg["Revenue per Customer"].tolist()
    )


# ── Ship mode → Discount band ──────────────────────────────────────────────────
@app.route("/api/shipmode")
def api_shipmode():
    df = apply_filters(df_raw.copy())
    bins   = [-0.01, 0.05, 0.15, 0.25, 0.40, 1.01]
    labels = ["0-5%","6-15%","16-25%","26-40%",">40%"]
    df["DiscBand"] = pd.cut(df["Discount"], bins=bins, labels=labels)
    sm = (df.groupby("DiscBand", observed=True)
            .agg(Products=("ProductID","count"), Revenue=("Revenue","sum"),
                 Avg_Rating=("Rating","mean"))
            .reset_index())
    sm["Avg_Rating"] = sm["Avg_Rating"].round(2)
    return jsonify(
        labels=sm["DiscBand"].astype(str).tolist(),
        orders=sm["Products"].tolist(),
        sales=sm["Revenue"].round(2).tolist(),
        avg_days=sm["Avg_Rating"].tolist()
    )


# ── Top products ───────────────────────────────────────────────────────────────
@app.route("/api/top-products")
def api_top_products():
    df = apply_filters(df_raw.copy())
    n  = int(request.args.get("n", 10))
    top = (df.groupby("ProductName")
             .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                  Units=("Sales","sum"))
             .reset_index()
             .sort_values("Revenue", ascending=False)
             .head(n))
    top["Margin"] = (top["Profit"] / top["Revenue"] * 100).round(2)
    top["ProductName"] = top["ProductName"].str[:40]
    return jsonify(
        labels=top["ProductName"].tolist(),
        sales=top["Revenue"].round(2).tolist(),
        profit=top["Profit"].round(2).tolist(),
        margin=top["Margin"].tolist()
    )


# ── Discount vs Profit scatter ─────────────────────────────────────────────────
@app.route("/api/discount-profit")
def api_discount_profit():
    df = apply_filters(df_raw.copy())
    sample = df.sample(min(500, len(df)), random_state=42)
    return jsonify(
        discount=sample["Discount"].round(3).tolist(),
        profit=sample["Profit"].round(2).tolist(),
        sales=sample["Revenue"].round(2).tolist(),
        category=sample["Category"].tolist()
    )


# ── Profitability analysis ─────────────────────────────────────────────────────
@app.route("/api/profitability")
def api_profitability():
    df = apply_filters(df_raw.copy())

    bins   = [-0.01, 0.0, 0.10, 0.20, 0.30, 0.40, 0.50, 1.01]
    labels = ["0%","1-10%","11-20%","21-30%","31-40%","41-50%",">50%"]
    df["Disc Bucket"] = pd.cut(df["Discount"], bins=bins, labels=labels)
    disc_profit = (df.groupby("Disc Bucket", observed=True)
                     .agg(Profit=("Profit","sum"), Orders=("ProductID","count"))
                     .reset_index())

    prod = (df.groupby("ProductName")
              .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"))
              .reset_index())
    prod["Margin"] = prod["Profit"] / prod["Revenue"] * 100

    high_margin = prod.nlargest(10,"Margin")[["ProductName","Revenue","Profit","Margin"]]
    low_margin  = prod.nsmallest(10,"Margin")[["ProductName","Revenue","Profit","Margin"]]
    high_margin["ProductName"] = high_margin["ProductName"].str[:38]
    low_margin["ProductName"]  = low_margin["ProductName"].str[:38]

    loss_orders = int((df["Profit"] < 0).sum())
    total_orders = len(df)

    return jsonify(
        discount_labels=disc_profit["Disc Bucket"].astype(str).tolist(),
        discount_profit=disc_profit["Profit"].round(2).tolist(),
        discount_orders=disc_profit["Orders"].tolist(),
        high_margin_products=high_margin["ProductName"].tolist(),
        high_margin_values=high_margin["Margin"].round(1).tolist(),
        low_margin_products=low_margin["ProductName"].tolist(),
        low_margin_values=low_margin["Margin"].round(1).tolist(),
        loss_making_orders=loss_orders,
        total_orders=total_orders,
        loss_pct=round(loss_orders / total_orders * 100, 1) if total_orders else 0
    )


# ── Customer value → Product value tiers ──────────────────────────────────────
@app.route("/api/customer-value")
def api_customer_value():
    df = apply_filters(df_raw.copy())

    prod = (df.groupby("ProductName")
              .agg(Revenue=("Revenue","sum"), Profit=("Profit","sum"),
                   Units=("Sales","sum"), Rating=("Rating","mean"),
                   Reviews=("NumReviews","sum"), Category=("Category","first"))
              .reset_index())
    prod["AOV"] = (prod["Revenue"] / prod["Units"]).round(2)

    s33 = prod["Revenue"].quantile(0.33)
    s66 = prod["Revenue"].quantile(0.66)
    def tier(v):
        if v >= s66: return "High Value"
        elif v >= s33: return "Mid Value"
        return "Low Value"
    prod["Tier"] = prod["Revenue"].apply(tier)

    tier_summary = (prod.groupby("Tier")
                       .agg(Count=("ProductName","count"),
                            Total_Sales=("Revenue","sum"),
                            Avg_Sales=("Revenue","mean"),
                            Avg_Orders=("Units","mean"))
                       .reset_index())
    tier_summary["Total_Sales"] = tier_summary["Total_Sales"].round(2)
    tier_summary["Avg_Sales"]   = tier_summary["Avg_Sales"].round(2)
    tier_summary["Avg_Orders"]  = tier_summary["Avg_Orders"].round(1)

    # Top 10 products
    top_custs = prod.nlargest(10,"Revenue")[
        ["ProductName","Category","Revenue","Profit","Units","Rating"]]
    top_custs["Revenue"] = top_custs["Revenue"].round(2)
    top_custs["Profit"]  = top_custs["Profit"].round(2)
    top_custs["Rating"]  = top_custs["Rating"].round(1)

    # AOV buckets
    aov_bins   = [0, 50, 150, 300, 600, 1000, 99999]
    aov_labels = ["<$50","$50-150","$150-300","$300-600","$600-1K","$1K+"]
    prod["AOV Bucket"] = pd.cut(prod["AOV"], bins=aov_bins, labels=aov_labels)
    aov_dist = prod["AOV Bucket"].value_counts().sort_index()

    return jsonify(
        tier_labels=tier_summary["Tier"].tolist(),
        tier_count=tier_summary["Count"].tolist(),
        tier_sales=tier_summary["Total_Sales"].tolist(),
        tier_avg_sales=tier_summary["Avg_Sales"].tolist(),
        tier_avg_orders=tier_summary["Avg_Orders"].tolist(),
        top_customer_names=top_custs["ProductName"].tolist(),
        top_customer_sales=top_custs["Revenue"].tolist(),
        top_customer_profit=top_custs["Profit"].tolist(),
        top_customer_orders=top_custs["Units"].tolist(),
        top_customer_rating=top_custs["Rating"].tolist(),
        top_customer_segment=top_custs["Category"].tolist(),
        aov_bucket_labels=aov_labels,
        aov_bucket_counts=aov_dist.tolist()
    )


# ── Business insights ──────────────────────────────────────────────────────────
@app.route("/api/insights")
def api_insights():
    df = apply_filters(df_raw.copy())
    insights = []

    total_rev    = df["Revenue"].sum()
    total_profit = df["Profit"].sum()
    margin       = total_profit / total_rev * 100 if total_rev else 0

    # 1. Best category
    cat = df.groupby("Category").agg(Profit=("Profit","sum"), Revenue=("Revenue","sum")).reset_index()
    cat["Margin"] = cat["Profit"] / cat["Revenue"] * 100
    best_cat = cat.loc[cat["Profit"].idxmax()]
    insights.append({
        "type":"positive","icon":"📦",
        "title":f"{best_cat['Category']} leads in profitability",
        "body":f"Generated ${best_cat['Profit']:,.0f} profit at {best_cat['Margin']:.1f}% margin — highest across all categories."
    })

    # 2. Worst category
    worst_cat = cat.loc[cat["Profit"].idxmin()]
    insights.append({
        "type":"negative","icon":"⚠️",
        "title":f"{worst_cat['Category']} has lowest profitability",
        "body":f"Only ${worst_cat['Profit']:,.0f} profit ({worst_cat['Margin']:.1f}% margin) — review pricing or discount strategy."
    })

    # 3. Top city
    city = df.groupby("City").agg(Revenue=("Revenue","sum")).reset_index()
    best_city = city.loc[city["Revenue"].idxmax()]
    insights.append({
        "type":"positive","icon":"🌆",
        "title":f"{best_city['City']} is the top revenue city",
        "body":f"${best_city['Revenue']:,.0f} in total revenue. Consider targeted marketing campaigns here."
    })

    # 4. Discount impact
    loss_pct    = (df["Profit"] < 0).mean() * 100
    high_disc   = df[df["Discount"] > 0.3]
    hd_margin   = (high_disc["Profit"].sum() / high_disc["Revenue"].sum() * 100) if len(high_disc) else 0
    insights.append({
        "type":"warning" if loss_pct > 20 else "neutral","icon":"🏷️",
        "title":f"{loss_pct:.1f}% of products are loss-making",
        "body":f"Products with discount >30% average {hd_margin:.1f}% margin. Cap heavy discounts to recover profitability."
    })

    # 5. Rating insight
    high_rated    = df[df["Rating"] >= 4.0]
    hr_margin     = (high_rated["Profit"].sum() / high_rated["Revenue"].sum() * 100) if len(high_rated) else 0
    low_rated     = df[df["Rating"] < 3.0]
    lr_margin     = (low_rated["Profit"].sum() / low_rated["Revenue"].sum() * 100) if len(low_rated) else 0
    insights.append({
        "type":"positive","icon":"⭐",
        "title":"High-rated products are more profitable",
        "body":f"4★+ products average {hr_margin:.1f}% margin vs {lr_margin:.1f}% for <3★ products. Focus on quality to drive margins."
    })

    # 6. Stock insight
    low_stock = int((df["StockQuantity"] < 20).sum())
    insights.append({
        "type":"neutral","icon":"📉",
        "title":f"{low_stock} products are low on stock",
        "body":f"These items risk stockouts. Prioritise restocking high-margin, high-demand SKUs first to avoid lost sales."
    })

    return jsonify(insights=insights)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
