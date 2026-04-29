# ===================== NutriVision FastAPI Backend =====================

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

import torch
import httpx
import torch.nn.functional as F
import torchvision.transforms as transforms
from torchvision import models
import torch.nn as nn
import os
import gdown
from PIL import Image
import pandas as pd
import numpy as np
from dotenv import load_dotenv
import json, os, io, joblib, re
from sentence_transformers import SentenceTransformer
import google.generativeai as genai

load_dotenv()

PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
MODEL_BASE = os.environ.get("MODEL_PATH", "./models")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
ai_model = genai.GenerativeModel('gemini-2.5-flash')

MODEL_FILES = {
    "mmfood_model.pth": "1zbGXCs7fi39q9Xvf3oLhwPUdDDrijqtb",
    "indian_food_model.pth": "1meyVD7oCGxkfrOoJKtpurwHdMCXgvlsg",
    "merged_df.pkl": "1T9K-0nmdUNZRvSFGmTRYLi9EUUyhllL2",
    "merged_index.joblib": "1UtuNxCqmEW2JinqGQEhNk0Tiyz7R8VQY",
    "mmfood_class_names.json": "1jVLCNdRF3TRC48s8LWBEiLm2dI-tLs6h",
    "MM-Food-100K.csv": "1QTIIbP4_nveLlsBAS292ZZhYHbwK1SZ4"
}

# ===================== INIT =====================
# app = FastAPI(title="NutriVision API", version="3.0", lifespan=lifespan)

from fastapi.staticfiles import StaticFiles

# app.mount("/static", StaticFiles(directory="static"), name="static")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[NutriVision] Using device: {device}")

# ===================== TRANSFORM =====================
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Lambda(lambda img: img.convert("RGB")),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# ===================== GLOBALS =====================
mmfood_df    = None
nutrition_df = None
merged_index = None
embedder     = None
main_model   = None
indian_model = None
main_classes  = []
indian_classes = []

templates = Jinja2Templates(directory="templates")

# ===================== COLUMN NAME VARIANTS =====================
# Every possible column name your CSVs might use for each field.
# We try them in order and take the first non-empty value.

_COL_CUISINE = ["cuisine", "Cuisine", "cuisine_type", "region", "Region", "origin"]
_COL_COURSE  = ["course",  "Course",  "meal_type",    "category", "Category",
                "dish_type", "DishType", "type"]
_COL_METHOD  = ["cooking_method", "CookingMethod", "cook_method",
                "method", "cooking_style", "technique", "Technique"]
_COL_DIET    = ["diet", "Diet", "diet_type", "dietary", "diet_tags",
                "veg_nonveg", "vegetarian", "DietType"]
_COL_PREP    = ["prep_time", "PrepTime", "prep_mins", "preparation_time",
                "prep_time_mins", "PrepTimeInMins", "prep"]
_COL_COOK    = ["cook_time", "CookTime", "cook_mins", "cooking_time",
                "cook_time_mins", "CookTimeInMins", "cook"]
_COL_TOTAL   = ["total_time", "TotalTime", "total_mins", "TotalTimeInMins",
                "time_in_mins", "total_time_mins", "total"]
_COL_SERVE   = ["servings", "Servings", "serves", "Serves", "yield",
                "serving_size", "portions", "Yield"]

def _pick(row, variants) -> str:
    """Return first non-empty string value found in row for any of the variants."""
    for c in variants:
        v = row.get(c, None)
        if v is not None:
            s = str(v).strip()
            if s and s.lower() not in ("nan", "none", "0", "0.0", ""):
                return s
    return ""

# ===================== LOAD =====================
def download_models():
    # ✅ Ensure models directory exists
    os.makedirs(MODEL_BASE, exist_ok=True)

    for filename, file_id in MODEL_FILES.items():
        path = os.path.join(MODEL_BASE, filename)

        if not os.path.exists(path):
            print(f"⬇️ Downloading {filename}...")

            url = f"https://drive.google.com/uc?id={file_id}"
            gdown.download(url, path, quiet=False)

        else:
            print(f"✅ {filename} already exists")
def load_all():
    global mmfood_df, nutrition_df, merged_index, embedder
    global main_model, indian_model, main_classes, indian_classes

    try:
        print("📂 MODEL PATH:", MODEL_BASE)

        path = f"{MODEL_BASE}/MM-Food-100K.csv"
        if os.path.exists(path):
            mmfood_df = pd.read_csv(path)
            print(f"[OK] MM-Food CSV — {len(mmfood_df)} rows | cols: {list(mmfood_df.columns)}")

        path = f"{MODEL_BASE}/merged_df.pkl"
        if os.path.exists(path):
            nutrition_df = pd.read_pickle(path)
            print(f"[OK] merged_df — {len(nutrition_df)} rows | cols: {list(nutrition_df.columns)}")

        path = f"{MODEL_BASE}/merged_index.joblib"
        if os.path.exists(path):
            merged_index = joblib.load(path)
            print("[OK] Search index loaded")

        embedder = SentenceTransformer('all-MiniLM-L6-v2')
        print("[OK] Embedder loaded")

        path = f"{MODEL_BASE}/mmfood_class_names.json"
        if os.path.exists(path):
            with open(path) as f:
                main_classes = json.load(f)

        path = f"{MODEL_BASE}/indian_food_dataset.json"
        if os.path.exists(path):
            with open(path) as f:
                raw = json.load(f)
                indian_classes = sorted(list(set(
                    x.get("dish_name", "") for x in raw if "dish_name" in x
                )))

        path = f"{MODEL_BASE}/mmfood_model.pth"
        if os.path.exists(path) and main_classes:
            m = models.resnet50(weights=None)
            m.fc = nn.Linear(m.fc.in_features, len(main_classes))
            m.load_state_dict(torch.load(path, map_location=device))
            main_model = m.to(device).eval()
            print("[OK] MMFood model loaded")

        path = f"{MODEL_BASE}/indian_food_model.pth"
        if os.path.exists(path) and indian_classes:
            m = models.resnet50(weights=None)
            m.fc = nn.Linear(m.fc.in_features, len(indian_classes))
            m.load_state_dict(torch.load(path, map_location=device))
            indian_model = m.to(device).eval()
            print("[OK] Indian model loaded")

        print("✅ All assets ready")

    except Exception as e:
        print("❌ Load Error:", e)


import threading
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Server starting...")

    def background_setup():
        try:
            download_models()   # ⬇️ Step 1
            load_all()          # 🧠 Step 2
        except Exception as e:
            print("❌ Startup error:", e)

    import threading
    threading.Thread(target=background_setup).start()

    yield

    print("🛑 Server shutting down...")

app = FastAPI(title="NutriVision API", version="3.0", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# load_all()          # THEN load

# ===================== HELPERS =====================

INDIAN_KEYWORDS = ["biryani", "curry", "dal", "paneer", "roti", "naan", "samosa",
                   "tikka", "masala", "sabzi", "kheer", "halwa", "chana", "rajma",
                   "dosa", "idli", "pulao", "korma", "vindaloo", "uttapam"]

def is_indian(text: str) -> bool:
    return any(w in text.lower() for w in INDIAN_KEYWORDS)

def run_model(model, img):
    with torch.no_grad():
        out   = model(img)
        probs = F.softmax(out, dim=1)
        conf, pred = torch.max(probs, 1)
    return float(conf.item()), int(pred.item())

def _slugify(text: str) -> str:
    return re.sub(r'\s+', '_', text.strip().lower())

def _keywords(text: str) -> list:
    stop = {'with','and','the','for','from','over','into','that','this',
            'your','style','easy','best','quick','homemade','simple',
            'classic','spicy','creamy','recipe','sauce'}
    return [w for w in re.findall(r'[a-z]+', text.lower())
            if len(w) >= 4 and w not in stop]

# ── Nutrition ─────────────────────────────────────────────────────────
def get_nutrition(dish: str) -> dict:
    # Strategy A: mmfood_df with 3-level matching
    if mmfood_df is not None and 'dish_name' in mmfood_df.columns:
        slug = _slugify(dish)
        col  = mmfood_df['dish_name'].astype(str).str.lower().str.strip()

        mask = col == slug
        if not mask.any():
            mask = col.str.replace('_', ' ', regex=False) == slug.replace('_', ' ')
        if not mask.any():
            kws = _keywords(dish)
            if kws:
                mask = col.str.contains('|'.join(re.escape(k) for k in kws),
                                        regex=True, na=False)
        if mask.any():
            raw = mmfood_df[mask].iloc[0].get('nutritional_profile', '{}')
            try:
                data = json.loads(str(raw).replace("'", '"')) \
                       if isinstance(raw, str) else (raw if isinstance(raw, dict) else {})
            except Exception:
                data = {}
            if data:
                return {
                    "calories": round(float(data.get("calories_kcal", data.get("calories", 0))), 1),
                    "protein":  round(float(data.get("protein_g",     data.get("protein",  0))), 1),
                    "carbs":    round(float(data.get("carbohydrate_g", data.get("carbs",    0))), 1),
                    "fat":      round(float(data.get("fat_g",          data.get("fat",      0))), 1),
                }

    # Strategy B: inline columns in merged_df
    if nutrition_df is not None:
        _NUT = {
            "calories": ["calories","calories_kcal","kcal","energy"],
            "protein":  ["protein","protein_g"],
            "carbs":    ["carbs","carbohydrate_g","carbohydrates"],
            "fat":      ["fat","fat_g","total_fat"],
        }
        avail = {k: next((c for c in alts if c in nutrition_df.columns), None)
                 for k, alts in _NUT.items()}
        if any(avail.values()):
            for col_name in ["title","dish_name","name"]:
                if col_name in nutrition_df.columns:
                    hits = nutrition_df[
                        nutrition_df[col_name].astype(str).str.lower()
                        .str.contains(_slugify(dish).replace('_',' '), na=False)
                    ]
                    if not hits.empty:
                        row = hits.iloc[0]
                        result = {}
                        for k, c in avail.items():
                            try:    result[k] = round(float(row[c]), 1) if c else 0.0
                            except: result[k] = 0.0
                        if any(v > 0 for v in result.values()):
                            return result

    print(f"[WARN] No nutrition for: {dish!r}")
    return {}

# ── Meta: cuisine, course, method, diet, timing ───────────────────────
def get_meta(row) -> dict:
    """Pull display metadata from any dataframe row using flexible column matching."""
    return {
        "cuisine":        _pick(row, _COL_CUISINE),
        "course":         _pick(row, _COL_COURSE),
        "cooking_method": _pick(row, _COL_METHOD),
        "diet":           _pick(row, _COL_DIET),
        "prep_mins":      _pick(row, _COL_PREP),
        "cook_mins":      _pick(row, _COL_COOK),
        "total_mins":     _pick(row, _COL_TOTAL),
        "servings":       _pick(row, _COL_SERVE),
    }

def get_meta_from_mmfood(dish: str) -> dict:
    """Try to find the dish in mmfood_df and extract its meta."""
    if mmfood_df is None or 'dish_name' not in mmfood_df.columns:
        return {}
    slug = _slugify(dish)
    col  = mmfood_df['dish_name'].astype(str).str.lower().str.strip()
    mask = col == slug
    if not mask.any():
        mask = col.str.replace('_',' ',regex=False) == slug.replace('_',' ')
    if not mask.any():
        kws = _keywords(dish)
        if kws:
            mask = col.str.contains('|'.join(re.escape(k) for k in kws),
                                    regex=True, na=False)
    if mask.any():
        return get_meta(mmfood_df[mask].iloc[0])
    return {}

def _merge_meta(base: dict, override: dict) -> dict:
    """override wins wherever it has a non-empty value."""
    merged = {**base}
    for k, v in override.items():
        if v:
            merged[k] = v
    return merged

# ── Recipe + similar dishes ───────────────────────────────────────────
def get_recipe(dish: str) -> dict:
    if nutrition_df is None or merged_index is None or embedder is None:
        return {}
    try:
        vec    = embedder.encode([dish])
        d, idx = merged_index.kneighbors(vec, n_neighbors=6)
        best   = nutrition_df.iloc[idx[0][0]]

        similar = []
        for ni in idx[0][1:]:
            if ni < len(nutrition_df):
                s     = nutrition_df.iloc[ni]
                title = str(s.get("title", s.get("dish_name",""))).strip()
                link  = str(s.get("url",   s.get("link","#"))).strip()
                if title and title not in ("nan",""):
                    similar.append({
                        "title": title,
                        "link":  link if link not in ("nan","") else "#"
                    })

        ings  = [x.strip() for x in str(best.get("ingredients","")).split(",")
                 if x.strip() and x.strip() != "nan"][:12]
        steps = [x.strip() for x in str(best.get("instructions","")).split(".")
                 if len(x.strip()) > 8][:8]

        return {
            "ingredients":    ings,
            "steps":          steps,
            "similar_dishes": similar,
            "meta":           get_meta(best),   # meta from the best-match row
        }
    except Exception as e:
        print("Recipe Error:", e)
        return {}
    
def get_ai_recommendations(food_name, nutrition):
    try:
        # 1. Clean the data to avoid f-string crashes
        p = nutrition.get('protein', 0)
        f = nutrition.get('fats', 0)
        c = nutrition.get('carbs', 0)
        cal = nutrition.get('calories', 0)

        # 2. Precise Prompt for Gemini 3 Flash
        prompt = f"""
        Role: Sports Nutritionist
        Context: User just ate {food_name}.
        Data: {p}g Protein, {f}g Fats, {c}g Carbs, {cal}kcal.
        
        Task: Provide 2 highly creative, pro-level nutritional recommendations.
        Style: Punchy, actionable, and scientific.
        Constraints: No fluff. Max 15 words per bullet. 
        Format: Return as two separate lines.
        """
        
        response = ai_model.generate_content(prompt)
        # Split by lines and filter out empty strings or bullet points
        lines = [l.strip().replace('*', '') for l in response.text.split('\n') if len(l.strip()) > 5]
        
        return lines[:2] if lines else ["Balanced profile.", "Hydrate well."]
    
    except Exception as e:
        print(f"DEBUG: Gemini Recommendation Failed -> {e}")
        return ["Focus on macro balance.", "Maintain consistent hydration."]

# ===================== ROUTES =====================

@app.get("/")
def home():
    return FileResponse("templates/index.html")

@app.get("/health")
def health():
    return {
        "main_model":   main_model is not None,
        "indian_model": indian_model is not None,
        "nutrition_df": nutrition_df is not None,
        "mmfood_df":    mmfood_df is not None,
        "index":        merged_index is not None,
    }

# ── /predict ──────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type.startswith("image"):
        raise HTTPException(status_code=400, detail="Upload a valid image")
    try:
        img_bytes = await file.read()
        image  = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_t  = transform(image).unsqueeze(0).to(device)

        main_conf = indian_conf = 0
        main_food = indian_food = ""

        if main_model and main_classes:
            main_conf, idx = run_model(main_model, img_t)
            main_food = main_classes[idx]
        if indian_model and indian_classes:
            indian_conf, idx = run_model(indian_model, img_t)
            indian_food = indian_classes[idx]

        if indian_conf > 0.5:
            final_food, model_used, confidence = indian_food, "Indian", indian_conf
        elif main_conf > 0.5:
            final_food, model_used, confidence = main_food, "Global", main_conf
        else:
            final_food = main_food or indian_food or "Unknown"
            model_used, confidence = "Fallback", max(main_conf, indian_conf)

        recipe    = get_recipe(final_food)
        nutrition = get_nutrition(final_food)
        # merge meta from both sources
        meta = _merge_meta(recipe.get("meta", {}), get_meta_from_mmfood(final_food))

        nutrition = get_nutrition(final_food)

        recommendations = get_ai_recommendations(final_food, nutrition)

        return JSONResponse(content={
            "dish_name":      final_food,
            "confidence":     round(confidence * 100, 2),
            "model_used":     model_used,
            "is_indian":      is_indian(final_food),
            "nutrition":      nutrition,
            "ai_recs":        recommendations,
            "ingredients":    recipe.get("ingredients", []),
            "steps":          recipe.get("steps", []),
            "similar_dishes": recipe.get("similar_dishes", []),
            # meta fields read directly by the frontend renderResults()
            "cuisine":        meta.get("cuisine",        ""),
            "course":         meta.get("course",         ""),
            "cooking_method": meta.get("cooking_method", ""),
            "diet":           meta.get("diet",           ""),
            "prep_mins":      meta.get("prep_mins",      ""),
            "cook_mins":      meta.get("cook_mins",      ""),
            "total_mins":     meta.get("total_mins",     ""),
            "servings":       meta.get("servings",       ""),
        })

    except Exception as e:
        print("❌ Prediction Error:", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


async def fetch_dish_image(dish_name: str) -> str:
    if not PEXELS_API_KEY:
        return "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg"
    headers = {"Authorization": PEXELS_API_KEY}
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                f"https://api.pexels.com/v1/search?query={dish_name} food&per_page=1",
                headers=headers, timeout=5
            )
            if r.status_code == 200:
                photos = r.json().get("photos", [])
                if photos:
                    return photos[0]["src"]["large2x"]
        except Exception as e:
            print(f"Pexels Error: {e}")
    return "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg"


# ── /search ───────────────────────────────────────────────────────────
@app.post("/search")
async def search_dish(request: Request):
    body  = await request.json()
    query = body.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Empty search query")

    try:
        if not (embedder and merged_index is not None and nutrition_df is not None):
            raise HTTPException(status_code=500, detail="Search index not loaded")

        query_vec          = embedder.encode([query])
        distances, indices = merged_index.kneighbors(query_vec, n_neighbors=6)

        best_idx     = indices[0][0]
        row          = nutrition_df.iloc[best_idx]
        recipe_title = str(row.get("title", row.get("dish_name", query))).strip()
        short_name   = str(row.get("dish_name", "")).strip()
        if not short_name or short_name == "nan":
            short_name = recipe_title

        # Similar dishes
        similar_dishes = []
        for ni in indices[0][1:]:
            if ni < len(nutrition_df):
                s     = nutrition_df.iloc[ni]
                title = str(s.get("title",    s.get("dish_name",""))).strip()
                link  = str(s.get("url",      s.get("link","#"))).strip()
                if title and title not in ("nan",""):
                    similar_dishes.append({
                        "title": title,
                        "link":  link if link not in ("nan","") else "#"
                    })

        # Nutrition with fallbacks
        nutrition = get_nutrition(short_name)
        if not nutrition:
            nutrition = get_nutrition(recipe_title)
        if not nutrition:
            nutrition = get_nutrition(query)

        # Recipe
        recipe = get_recipe(short_name if short_name != recipe_title else query)

        # Meta: merge direct row data + mmfood lookup
        meta = _merge_meta(get_meta(row), get_meta_from_mmfood(short_name))

        image_url = await fetch_dish_image(recipe_title)

        recommendations = get_ai_recommendations(recipe_title, nutrition)

        return JSONResponse(content={
            "dish_name":      recipe_title,
            "image_url":      image_url,
            "confidence":     100,
            "model_used":     "Semantic Search",
            "is_indian":      is_indian(recipe_title),
            "nutrition":      nutrition,
            "ai_recs":        recommendations,
            "ingredients":    recipe.get("ingredients", []),
            "recipe_steps":   recipe.get("steps", []),
            "similar_dishes": similar_dishes,
            "source_link":    str(row.get("url", row.get("source","#"))).strip(),
            # meta fields
            "cuisine":        meta.get("cuisine",        ""),
            "course":         meta.get("course",         ""),
            "cooking_method": meta.get("cooking_method", ""),
            "diet":           meta.get("diet",           ""),
            "prep_mins":      meta.get("prep_mins",      ""),
            "cook_mins":      meta.get("cook_mins",      ""),
            "total_mins":     meta.get("total_mins",     ""),
            "servings":       meta.get("servings",       ""),
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Search Error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")

# 1. Chat Assistant Route
@app.post("/chat")
async def chat_assistant(request: dict):
    user_msg = request.get("message", "")
    if not user_msg:
        return {"reply": "I'm listening! Ask me anything about your meal."}
    
    # Giving the AI context so it acts like NutriVision Assistant
    chat_prompt = f"You are the NutriVision AI Health Assistant. User asks: {user_msg}"
    response = ai_model.generate_content(chat_prompt)
    return {"reply": response.text}

