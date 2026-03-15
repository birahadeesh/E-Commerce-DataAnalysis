# E-Commerce Product Intelligence Dashboard 📊✨

Welcome to the **E-Commerce Analytics Dashboard**! 

This project is a premium, interactive web application built to analyze global e-commerce dataset spanning 2023–2024. It transforms raw product and sales data into actionable business intelligence using a sleek, glassmorphism-inspired dark mode UI.

---

## 🚀 Features

* **High-Level KPIs:** Instant visibility into Total Revenue, Profit, Margin, Units Sold, and Average Ratings with Year-over-Year (YoY) comparisons.
* **Interactive Visualizations:**
  * Monthly revenue & profit trends area charts.
  * Category-wise performance breakdowns.
  * City-level geographic performance bars.
  * Customer value and rating tier doughnut charts.
* **AI-Driven Insights Section:** Automatically generated business recommendations (e.g., identifying highest margin categories, low-stock warnings, and discounting impacts).
* **Live Dynamic Filtering:** Filter the entire dashboard by specific Years and Categories instantly.
* **Premium UI/UX:** Built with a modern dark theme, animated background mesh, floating ambient orbs, 3D card tilts, and smooth intersection-observer scrolling.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask, Pandas (for data manipulation and metric aggregation).
* **Frontend:** HTML5, CSS3 (Custom Glassmorphism styling), Vanilla JavaScript.
* **Charting:** Chart.js (v4.4.0) with DataLabels plugin.

---

## ⚙️ How to Run Locally

1. **Prerequisites:** Ensure you have Python 3.8+ installed.
2. **Clone/Download** this repository.
3. **Install Dependencies:**
   ```bash
   pip install flask pandas numpy flask-cors
   ```
4. **Run the Application:**
   ```bash
   python app.py
   ```
5. **View the Dashboard:** Open your browser and navigate to `http://127.0.0.1:5000`

---

## 📁 Project Structure

```text
ecomdataanalysis/
│
├── app.py                      # Flask backend and data processing API
├── ecommerce_product_dataset.csv # The core mock dataset
├── templates/
│   └── index.html              # Main dashboard HTML structure
├── static/
│   ├── css/
│   │   └── styles.css          # Core styles, animations, and glassmorphism UI
│   └── js/
│       └── app.js              # Frontend logic, API fetching, and Chart.js setups
└── README.md                   # Project documentation
```

---

## 💡 Note on the Dataset
The included `ecommerce_product_dataset.csv` is a comprehensive mock dataset designed specifically to showcase the capabilities of this dashboard, featuring realistic seasonal trends, discounting impacts, and profitability metrics.
