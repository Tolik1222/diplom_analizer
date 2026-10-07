import json
from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from app.analyzer.metrics import analyze_image_full
from app.analyzer.decision_engine import determine_optimization_strategy
from app.analyzer.optimizer import execute_optimization
from app.analyzer.forensics import generate_forensic_mode
from app.db import (
    register_user,
    authenticate_user,
    get_user_by_token,
    revoke_token,
    save_history_entry,
    get_history_entries,
    get_history_entry_detail,
    delete_history_entry,
    clear_history_entries
)

app = FastAPI(
    title="Intelligent Adaptive Image Optimization System",
    description="Diploma project API for automated image quality assessment, user authentication, and history",
    version="1.1.0"
)

# Allow CORS for local development & deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper Models and Dependency
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = ""


class LoginRequest(BaseModel):
    username: str
    password: str


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").replace("bearer ", "").strip()
    return get_user_by_token(token)


# ---------------------------------------------------------------------------
# Base & Health Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "OptiMetrics AI — Adaptive Image Optimization API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": [
            "POST /api/auth/register",
            "POST /api/auth/login",
            "GET /api/auth/me",
            "POST /api/auth/logout",
            "GET /api/history",
            "GET /api/history/{id}",
            "DELETE /api/history/{id}",
            "POST /api/analyze",
            "POST /api/optimize",
            "POST /api/process-all",
            "POST /api/batch-process",
            "POST /api/forensics"
        ]
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Image Assessment & Adaptive Optimization Engine",
        "database": "SQLite (users & history ready)",
        "algorithms": [
            "Immerkaer Fast Noise Estimation",
            "Donoho Wavelet MAD Estimator",
            "ITU-T P.910 Spatial Information (SI)",
            "Shannon Information Entropy",
            "Laplacian Sharpness Variance",
            "2D FFT Spectral Distribution",
            "JPEG Chroma Subsampling Detector (SOF)",
            "Adaptive Multi-Criteria Decision Engine",
            "Bilateral Edge-Preserving Denoising",
            "PSNR / SSIM Objective Validation",
            "AGU DCT 32x32 (QS)",
            "ADCT partition DCT (QS)",
            "BPG HEVC-Intra model (Q=1..51)"
        ]
    }


# ---------------------------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register")
async def auth_register(req: RegisterRequest):
    try:
        user_info = register_user(req.username, req.password, req.email or "")
        return {
            "success": True,
            "message": "Реєстрація успішна",
            "user": {
                "id": user_info["user_id"],
                "username": user_info["username"],
                "email": user_info["email"]
            },
            "token": user_info["token"]
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка реєстрації: {str(e)}")


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest):
    user_info = authenticate_user(req.username, req.password)
    if not user_info:
        raise HTTPException(status_code=401, detail="Невірне ім'я користувача або пароль.")
    return {
        "success": True,
        "message": "Вхід виконано успішно",
        "user": {
            "id": user_info["user_id"],
            "username": user_info["username"],
            "email": user_info["email"]
        },
        "token": user_info["token"]
    }


@app.get("/api/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    user = get_current_user_optional(authorization)
    if not user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": user
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").replace("bearer ", "").strip()
        revoke_token(token)
    return {"success": True, "message": "Сесію завершено"}


# ---------------------------------------------------------------------------
# Analysis History Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/history")
async def get_history(limit: int = 20, authorization: Optional[str] = Header(None)):
    """Returns recent analysis history records for the current user or guest."""
    user = get_current_user_optional(authorization)
    user_id = user["id"] if user else None
    items = get_history_entries(user_id=user_id, limit=limit)
    return {
        "success": True,
        "user_id": user_id,
        "count": len(items),
        "history": items
    }


@app.get("/api/history/{history_id}")
async def get_history_item(history_id: int, authorization: Optional[str] = Header(None)):
    """Returns full assessment details for a specific history item."""
    user = get_current_user_optional(authorization)
    user_id = user["id"] if user else None
    item = get_history_entry_detail(history_id, user_id=user_id)
    if not item:
        raise HTTPException(status_code=404, detail="Запис історії не знайдено.")
    return {
        "success": True,
        "item": item
    }


@app.delete("/api/history/{history_id}")
async def delete_history(history_id: int, authorization: Optional[str] = Header(None)):
    user = get_current_user_optional(authorization)
    user_id = user["id"] if user else None
    deleted = delete_history_entry(history_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Запис не знайдено або доступ заборонено.")
    return {"success": True, "message": "Запис видалено"}


@app.delete("/api/history")
async def clear_history(authorization: Optional[str] = Header(None)):
    user = get_current_user_optional(authorization)
    user_id = user["id"] if user else None
    clear_history_entries(user_id=user_id)
    return {"success": True, "message": "Історію очищено"}


# ---------------------------------------------------------------------------
# Image Analysis & Optimization Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyzes an uploaded image: computes noise, entropy, complexity, sharpness,
    chroma subsampling, and generates the recommended optimization strategy.
    """
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        metrics = analyze_image_full(raw_bytes, filename=file.filename or "uploaded_image")
        strategy = determine_optimization_strategy(metrics)

        return {
            "success": True,
            "metrics": metrics,
            "strategy": strategy
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/optimize")
async def optimize_image(
    file: UploadFile = File(...),
    custom_strategy: Optional[str] = Form(None)
):
    """
    Optimizes the uploaded image according to the recommended or custom strategy.
    Returns the compressed image data URL and PSNR/SSIM metrics.
    """
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        if custom_strategy:
            strategy = json.loads(custom_strategy)
        else:
            metrics = analyze_image_full(raw_bytes, filename=file.filename or "uploaded_image")
            strategy = determine_optimization_strategy(metrics)

        result = execute_optimization(raw_bytes, strategy)
        return {
            "success": True,
            "strategy_used": strategy,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@app.post("/api/forensics")
async def get_forensics(
    file: UploadFile = File(...),
    mode: str = Form("original"),
    extra_param: str = Form("")
):
    """
    Forensics and advanced image diagnostic inspection modes.
    """
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        result = generate_forensic_mode(raw_bytes, mode=mode, extra_param=extra_param)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forensics calculation failed: {str(e)}")


@app.post("/api/process-all")
async def process_all_in_one(
    file: UploadFile = File(...),
    custom_strategy: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """
    Full pipeline in one request:
    1. Full metric analysis
    2. Decision engine recommendation
    3. Optimization execution & SSIM/PSNR calculation
    4. Automatically saves history record in DB
    """
    try:
        raw_bytes = await file.read()
        if len(raw_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # 1. Analyze
        metrics = analyze_image_full(raw_bytes, filename=file.filename or "image")

        # 2. Decision strategy (default or override)
        if custom_strategy:
            strategy = json.loads(custom_strategy)
        else:
            strategy = determine_optimization_strategy(metrics)

        # 3. Optimize
        optimization_result = execute_optimization(raw_bytes, strategy)

        # 4. Save to Database history
        user = get_current_user_optional(authorization)
        user_id = user["id"] if user else None
        history_id = save_history_entry(
            user_id=user_id,
            filename=file.filename or "image",
            raw_bytes=raw_bytes,
            metrics=metrics,
            strategy=strategy,
            optimization=optimization_result
        )

        return {
            "success": True,
            "history_id": history_id,
            "metrics": metrics,
            "strategy": strategy,
            "optimization": optimization_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {str(e)}")


@app.post("/api/batch-process")
async def batch_process_images(
    files: List[UploadFile] = File(...),
    custom_strategy: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """
    Batch processing pipeline for multiple images simultaneously.
    Saves history record for each image in the database.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided for batch processing.")

    user = get_current_user_optional(authorization)
    user_id = user["id"] if user else None

    parsed_strategy = None
    if custom_strategy:
        try:
            parsed_strategy = json.loads(custom_strategy)
        except Exception:
            parsed_strategy = None

    items = []
    total_orig_bytes = 0
    total_opt_bytes = 0
    total_ssim = 0.0
    total_psnr = 0.0
    valid_count = 0

    for file in files:
        try:
            raw_bytes = await file.read()
            if len(raw_bytes) == 0:
                continue

            metrics = analyze_image_full(raw_bytes, filename=file.filename or "image")
            if parsed_strategy:
                strategy = parsed_strategy
            else:
                strategy = determine_optimization_strategy(metrics)

            optimization_result = execute_optimization(raw_bytes, strategy)

            orig_size = optimization_result.get("original_size_bytes", len(raw_bytes))
            opt_size = optimization_result.get("optimized_size_bytes", len(raw_bytes))
            ssim_val = float(optimization_result.get("ssim", 1.0))
            psnr_val = float(optimization_result.get("psnr_db", 0.0))

            total_orig_bytes += orig_size
            total_opt_bytes += opt_size
            total_ssim += ssim_val
            total_psnr += psnr_val
            valid_count += 1

            # Save each batch item to DB history
            h_id = save_history_entry(
                user_id=user_id,
                filename=file.filename or "image",
                raw_bytes=raw_bytes,
                metrics=metrics,
                strategy=strategy,
                optimization=optimization_result
            )

            items.append({
                "filename": file.filename or "image",
                "history_id": h_id,
                "success": True,
                "metrics": metrics,
                "strategy": strategy,
                "optimization": optimization_result
            })
        except Exception as item_err:
            items.append({
                "filename": file.filename or "image",
                "success": False,
                "error": str(item_err)
            })

    total_saved_bytes = max(0, total_orig_bytes - total_opt_bytes)
    saved_percent = round((total_saved_bytes / max(1, total_orig_bytes)) * 100.0, 1)
    avg_ssim = round(total_ssim / max(1, valid_count), 4) if valid_count > 0 else 1.0
    avg_psnr = round(total_psnr / max(1, valid_count), 2) if valid_count > 0 else 0.0

    return {
        "success": True,
        "summary": {
            "total_files": len(files),
            "processed_count": valid_count,
            "total_original_bytes": total_orig_bytes,
            "total_optimized_bytes": total_opt_bytes,
            "total_saved_bytes": total_saved_bytes,
            "total_saved_percent": saved_percent,
            "compression_ratio": round(total_orig_bytes / max(1, total_opt_bytes), 2),
            "average_ssim": avg_ssim,
            "average_psnr_db": avg_psnr
        },
        "items": items
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
