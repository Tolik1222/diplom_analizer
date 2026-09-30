import io
import math
import base64
import numpy as np
import cv2
from PIL import Image, ImageOps
from skimage.metrics import structural_similarity as ssim_func
from typing import Dict, Any, Tuple

from app.analyzer.research_codecs import encode_research_codec, preview_png_bytes


JPEG_SUBSAMPLING = {
    "4:4:4": 0,
    "4:2:2": 1,
    "4:2:0": 2,
}

RESEARCH_CODECS = {"AGU", "ADCT", "BPG"}


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
    score, _ = ssim_func(img1, img2, channel_axis=2, full=True, data_range=255)
    return float(score)


def _normalize_chroma(value: str) -> str:
    raw = str(value or "4:2:0")
    for token in ("4:4:4", "4:2:2", "4:2:0"):
        if token in raw:
            return token
    return "4:2:0"


def _pcc_meta(fmt: str, quality, is_lossless: bool) -> Tuple[str, float]:
    if is_lossless and fmt in ("WEBP", "PNG", "BPG", "AGU", "ADCT"):
        return "lossless", 0.0
    if fmt in ("AGU", "ADCT"):
        return "QS", float(quality)
    if fmt == "BPG":
        return "Q", int(quality)
    return "Q", int(quality)


def _save_standard(
    processed_pil: Image.Image,
    target_format: str,
    quality: int,
    is_lossless: bool,
    chroma: str,
) -> Tuple[bytes, str, str]:
    output_buffer = io.BytesIO()

    if target_format == "WEBP":
        processed_pil.save(
            output_buffer,
            format="WEBP",
            quality=int(np.clip(quality, 0, 100)),
            lossless=is_lossless,
            method=6,
        )
        return output_buffer.getvalue(), "image/webp", "webp"

    if target_format in ("JPEG", "JPG"):
        q = int(np.clip(quality, 1, 100))
        sub_param = JPEG_SUBSAMPLING.get(chroma, 2)
        processed_pil.convert("RGB").save(
            output_buffer,
            format="JPEG",
            quality=q,
            optimize=True,
            progressive=True,
            subsampling=sub_param,
        )
        return output_buffer.getvalue(), "image/jpeg", "jpg"

    if target_format == "PNG":
        processed_pil.save(
            output_buffer,
            format="PNG",
            optimize=True,
            compress_level=int(np.clip(quality if quality <= 9 else 9, 0, 9)),
        )
        return output_buffer.getvalue(), "image/png", "png"

    processed_pil.save(output_buffer, format="WEBP", quality=int(np.clip(quality, 0, 100)))
    return output_buffer.getvalue(), "image/webp", "webp"


def execute_optimization(
    raw_bytes: bytes,
    strategy: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Executes pre-filtering, color normalization, and target compression.
    Computes PSNR and SSIM validation metrics.
    """
    pil_img = Image.open(io.BytesIO(raw_bytes))
    pil_img = ImageOps.exif_transpose(pil_img)

    orig_rgb_pil = pil_img.convert("RGB")
    orig_rgb_np = np.array(orig_rgb_pil)
    working_rgb_np = orig_rgb_np.copy()

    filter_type = strategy.get("denoise_filter", "none")
    if "bilateral" in str(filter_type):
        params = strategy.get("filter_params", {})
        d = params.get("diameter", 5)
        sc = params.get("sigmaColor", 25)
        ss = params.get("sigmaSpace", 25)
        working_bgr = cv2.cvtColor(working_rgb_np, cv2.COLOR_RGB2BGR)
        denoised_bgr = cv2.bilateralFilter(working_bgr, d, sc, ss)
        working_rgb_np = cv2.cvtColor(denoised_bgr, cv2.COLOR_BGR2RGB)

    processed_pil = Image.fromarray(working_rgb_np)

    target_format = str(strategy.get("recommended_format", "WEBP")).upper()
    is_lossless = bool(strategy.get("is_lossless", False))
    chroma = _normalize_chroma(strategy.get("chroma_subsampling", "4:2:0"))
    raw_quality = strategy.get("recommended_quality", 84)

    if target_format in RESEARCH_CODECS:
        pcc = float(raw_quality)
        if target_format == "BPG":
            pcc = float(int(np.clip(round(pcc), 1, 51)))
        else:
            pcc = float(np.clip(pcc, 0.05, 200.0))
        bitstream, recon_rgb, codec_info = encode_research_codec(
            working_rgb_np,
            target_format,
            pcc,
            chroma=chroma,
            lossless=is_lossless,
        )
        preview_bytes = preview_png_bytes(recon_rgb)
        compressed_bytes = bitstream
        mime_type = "application/octet-stream"
        ext = target_format.lower()
        preview_mime = "image/png"
        quality = codec_info["pcc"]
        chroma = codec_info["chroma"]
        is_lossless = codec_info["lossless"]
        compressed_rgb_np = recon_rgb
        preview_b64 = base64.b64encode(preview_bytes).decode("utf-8")
        download_b64 = base64.b64encode(compressed_bytes).decode("utf-8")
        data_url = f"data:{preview_mime};base64,{preview_b64}"
        download_data_url = f"data:{mime_type};base64,{download_b64}"
    else:
        if target_format in ("JPEG", "JPG"):
            quality = int(np.clip(int(round(float(raw_quality))), 1, 100))
            is_lossless = False
        elif target_format == "PNG":
            quality = int(np.clip(int(round(float(raw_quality))), 0, 9))
            is_lossless = True
            chroma = "4:4:4"
        else:
            quality = int(np.clip(int(round(float(raw_quality))), 0, 100))
            target_format = "WEBP"
            if is_lossless:
                chroma = "4:4:4"

        compressed_bytes, mime_type, ext = _save_standard(
            processed_pil, target_format, int(quality), is_lossless, chroma
        )
        compressed_pil = Image.open(io.BytesIO(compressed_bytes)).convert("RGB")
        compressed_rgb_np = np.array(compressed_pil)
        b64_data = base64.b64encode(compressed_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_data}"
        download_data_url = data_url

    orig_size_bytes = len(raw_bytes)
    new_size_bytes = len(compressed_bytes)
    saved_bytes = orig_size_bytes - new_size_bytes
    saved_percent = round((saved_bytes / orig_size_bytes) * 100.0, 1) if orig_size_bytes else 0.0

    if compressed_rgb_np.shape != orig_rgb_np.shape:
        compressed_rgb_np = cv2.resize(compressed_rgb_np, (orig_rgb_np.shape[1], orig_rgb_np.shape[0]))

    psnr_score = calculate_psnr(orig_rgb_np, compressed_rgb_np)
    ssim_score = calculate_ssim(orig_rgb_np, compressed_rgb_np)
    pcc_name, pcc_value = _pcc_meta(target_format, quality, is_lossless)

    quality_out = quality if target_format in ("AGU", "ADCT") else int(round(float(quality)))

    return {
        "format": target_format,
        "extension": ext,
        "mime_type": mime_type,
        "quality_applied": quality_out,
        "pcc_name": pcc_name,
        "pcc_value": pcc_value,
        "chroma_subsampling": chroma,
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
        "data_url": data_url,
        "download_data_url": download_data_url,
    }
