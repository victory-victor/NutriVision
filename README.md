# NutriVision — AI Food Intelligence
FastAPI + Dual Classifier + Semantic Recipe Search

---

## 🚀 Quick Start

### 1. Install dependencies
pip install -r requirements.txt

### 2. Set model path
export MODEL_PATH="./models"

### 3. Run server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

### 4. Open
http://localhost:8000

---

## 📁 Required Files (inside /models)

- mmfood_model.pth
- indian_food_model.pth
- mmfood_class_names.json
- indian_food_dataset.json
- MM-Food-100K.csv
- merged_df.pkl
- merged_index.joblib

---

## 🔌 API

### POST /predict
Upload food image → returns dish, nutrition, recipe

### POST /search
Search by dish name

### GET /health
Check model status

---

## 🧠 Pipeline

Image → Classifiers → Best Dish  
       ↓  
Nutrition (CSV)  
       ↓  
Semantic Search → Recipe + Ingredients + Steps  

---

## 🐳 Docker

Build:
docker build -t nutrivision .

Run:
docker run -p 8000:8000 nutrivision
