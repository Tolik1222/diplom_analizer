import io
import math
import base64
import numpy as np
import cv2
from PIL import Image, ImageOps
from skimage.metrics import structural_similarity as ssim_func
from typing import Dict, Any, Tuple


def calculate_psnr(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Computes Peak Signal-to-Noise Ratio (PSNR) in dB.
    PSNR = 10 * log10(255^2 / MSE)
    """
    mse = np.mean((img1.astype(np.float64) - img2.astype(np.float64)) ** 2)
    if mse == 0:
        return 100.0  # Identical images
    max_pixel = 255.0
    return float(10.0 * math.log10((max_pixel ** 2) / mse))


def calculate_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Computes Mean Structural Similarity Index (SSIM) across RGB channels.
    Range: -1.0 to 1.0 (1.0 is identical quality).
    """
    # Channel-wise SSIM
    score, _ = ssim_func(img1, img2, channel_axis=2, full=True, data_range=255)
    return float(score)


def execute_optimization(
    raw_bytes: bytes,
    strategy: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes pre-filtering, color normalization, and target compression.
    Computes PSNR and SSIM validation metrics.
    """
    pil_img = Image.open(io.BytesIO(raw_bytes))
    # Correct orientation based on EXIF tag if needed
    pil_img = ImageOps.exif_transpose(pil_img)
    
    # Store original RGB representation for metric calculation
    orig_rgb_pil = pil_img.convert("RGB")
    orig_rgb_np = np.array(orig_rgb_pil)

    working_rgb_np = orig_rgb_np.copy()

    # 1. Apply pre-filtering (denoising) if instructed
    filter_type = strategy.get("denoise_filter", "none")
    if "bilateral" in filter_type:
        params = strategy.get("filter_params", {})
        d = params.get("diameter", 5)
        sc = params.get("sigmaColor", 25)
        ss = params.get("sigmaSpace", 25)
        working_bgr = cv2.cvtColor(working_rgb_np, cv2.COLOR_RGB2BGR)
        denoised_bgr = cv2.bilateralFilter(working_bgr, d, sc, ss)
        working_rgb_np = cv2.cvtColor(denoised_bgr, cv2.COLOR_BGR2RGB)

    processed_pil = Image.fromarray(working_rgb_np)

    # 2. Target format & compression
    target_format = strategy.get("recommended_format", "WEBP").upper()
    quality = int(strategy.get("recommended_quality", 84))
    is_lossless = bool(strategy.get("is_lossless", False))
    subsampling = strategy.get("chroma_subsampling", "4:2:0")

    output_buffer = io.BytesIO()

    if target_format == "WEBP":
        # Save as WebP
        processed_pil.save(
            output_buffer,
            format="WEBP",
            quality=quality,
            lossless=is_lossless,
            method=6  # Highest compression effort
        )
        mime_type = "image/webp"
        ext = "webp"
    elif target_format == "JPEG" or target_format == "JPG":
        # Save as Progressive JPEG
        # Subsampling parameter in Pillow: 0=4:4:4, 1=4:2:2, 2=4:2:0
        sub_param = 0 if "4:4:4" in subsampling else 2
        processed_pil.save(
            output_buffer,
            format="JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
            subsampling=sub_param
        )
        mime_type = "image/jpeg"
        ext = "jpg"
    elif target_format == "PNG":
        processed_pil.save(
            output_buffer,
            format="PNG",
            optimize=True
        )
        mime_type = "image/png"
        ext = "png"
    else:
        # Fallback to WebP
        processed_pil.save(output_buffer, format="WEBP", quality=quality)
        mime_type = "image/webp"
        ext = "webp"

    compressed_bytes = output_buffer.getvalue()
    new_size_bytes = len(compressed_bytes)
    orig_size_bytes = len(raw_bytes)
    
    saved_bytes = orig_size_bytes - new_size_bytes
    saved_percent = round((saved_bytes / orig_size_bytes) * 100.0, 1)

    # 3. Validation metrics (SSIM & PSNR)
    # Decode compressed result back to RGB for pixel-level objective quality comparison
    compressed_pil = Image.open(io.BytesIO(compressed_bytes)).convert("RGB")
    compressed_rgb_np = np.array(compressed_pil)

    # Ensure identical shape if any subpixel alignment occurred
    if compressed_rgb_np.shape != orig_rgb_np.shape:
        compressed_rgb_np = cv2.resize(compressed_rgb_np, (orig_rgb_np.shape[1], orig_rgb_np.shape[0]))

    psnr_score = calculate_psnr(orig_rgb_np, compressed_rgb_np)
    ssim_score = calculate_ssim(orig_rgb_np, compressed_rgb_np)

    # Base64 string for direct frontend rendering without extra disk saving
    b64_data = base64.b64encode(compressed_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_data}"

    return {
        "format": target_format,
        "extension": ext,
        "mime_type": mime_type,
        "quality_applied": quality,
        "is_lossless": is_lossless,
        "applied_filter": filter_type,
        "original_size_bytes": orig_size_bytes,
        "optimized_size_bytes": new_size_bytes,
        "original_size_kb": round(orig_size_bytes / 1024, 1),
        "optimized_size_kb": round(new_size_bytes / 1024, 1),
        "saved_bytes": saved_bytes,
        "saved_percent": saved_percent,
        "psnr_db": round(psnr_score, 2),
        "ssim": round(ssim_score, 4),
        "data_url": data_url
    }
