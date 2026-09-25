import json
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional

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
            "PSNR / SSIM Objective Validation"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
