import json
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List

from app.analyzer.metrics import analyze_image_full
from app.analyzer.decision_engine import determine_optimization_strategy
from app.analyzer.optimizer import execute_optimization
from app.analyzer.forensics import generate_forensic_mode

app = FastAPI(
    title="Intelligent Adaptive Image Optimization System",
    description="Diploma project API for automated image quality assessment and adaptive preparation",
    version="1.0.0"
)

# Allow CORS for local development (Vite typically runs on 5173 or similar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "OptiMetrics AI — Adaptive Image Optimization API",
        "status": "running",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": [
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

        # Run mathematical analysis
        metrics = analyze_image_full(raw_bytes, filename=file.filename or "uploaded_image")
        
        # Run decision engine
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
    Forensics and advanced image diagnostic inspection modes:
    Original, ELA, Noise, Luminance Gradient, Level Sweep, PCA, Edge Detection,
    Histogram Equalize (CLAHE), Channel Isolation, Bit-Plane (LSB), Clone Detection.
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
    custom_strategy: Optional[str] = Form(None)
):
    """
    Full pipeline in one request:
    1. Full metric analysis
    2. Decision engine recommendation
    3. Optimization execution & SSIM/PSNR calculation
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

        return {
            "success": True,
            "metrics": metrics,
            "strategy": strategy,
            "optimization": optimization_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {str(e)}")


@app.post("/api/batch-process")
async def batch_process_images(
    files: List[UploadFile] = File(...),
    custom_strategy: Optional[str] = Form(None)
):
    """
    Batch processing pipeline for multiple images simultaneously:
    Computes diagnostic metrics, applies adaptive decision strategy,
    compresses each image, and returns overall batch statistics.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided for batch processing.")

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

            items.append({
                "filename": file.filename or "image",
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
