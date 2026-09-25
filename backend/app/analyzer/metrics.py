import io
import math
import struct
import numpy as np
import cv2
from PIL import Image, ImageCms


def estimate_noise_immerkaer(gray: np.ndarray) -> float:
    """
    Fast Noise Variance Estimation by J. Immerkaer (1996).
    Uses a 3x3 Laplacian-derived high-pass filter mask to compute sigma of additive zero-mean Gaussian noise.
    """
    h, w = gray.shape
    if h < 3 or w < 3:
        return 0.0

    mask = np.array([[1, -2, 1],
                     [-2, 4, -2],
                     [1, -2, 1]], dtype=np.float32)

    filtered = cv2.filter2D(gray.astype(np.float32), -1, mask, borderType=cv2.BORDER_CONSTANT)
    # Exclude 1-pixel border where mask cannot be fully evaluated
    valid_region = filtered[1:h-1, 1:w-1]
    sigma = np.sum(np.abs(valid_region)) * math.sqrt(0.5 * math.pi) / (6.0 * (w - 2) * (h - 2))
    return float(sigma)


def estimate_noise_donoho_haar(gray: np.ndarray) -> float:
    """
    Donoho's Median Absolute Deviation (MAD) noise estimator on 2D Haar Wavelet HH subband.
    sigma = median(|HH1|) / 0.6745
    """
    h, w = gray.shape
    h_even = h - (h % 2)
    w_even = w - (w % 2)
    if h_even < 4 or w_even < 4:
        return 0.0

    cropped = gray[:h_even, :w_even].astype(np.float32)
    # HH subband calculation from 2D Haar wavelet:
    # HH = (I[0::2, 0::2] - I[1::2, 0::2] - I[0::2, 1::2] + I[1::2, 1::2]) / 2.0
    hh = (cropped[0::2, 0::2] - cropped[1::2, 0::2] - cropped[0::2, 1::2] + cropped[1::2, 1::2]) / 2.0
    abs_hh = np.abs(hh)
    med = np.median(abs_hh)
    sigma = med / 0.6745
    return float(sigma)


def calculate_shannon_entropy(gray: np.ndarray) -> float:
    """
    Calculates Shannon Entropy in bits per pixel.
    Max value for 8-bit image is 8.0 bits.
    """
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    total_pixels = gray.size
    hist_norm = hist / total_pixels
    non_zero = hist_norm[hist_norm > 0]
    entropy = -np.sum(non_zero * np.log2(non_zero))
    return float(entropy)


def calculate_spatial_information(gray: np.ndarray) -> float:
    """
    Computes ITU-T P.910 Spatial Information (SI) metric:
    SI = std( sqrt(Sobel_x^2 + Sobel_y^2) )
    Measures spatial detail and edge activity.
    """
    sobel_x = cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    magnitude = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
    si = float(np.std(magnitude))
    return si


def calculate_sharpness_and_blur(gray: np.ndarray) -> dict:
    """
    Computes Laplacian variance for sharpness / blur detection.
    High variance indicates high frequency edge content (sharp).
    Low variance indicates smooth / blurred content.
    """
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = float(laplacian.var())
    
    # Normalized score between 0 (completely blurred) and 100 (ultra sharp)
    # Using asymptotic saturation curve: 100 * (1 - exp(-variance / 250))
    sharpness_score = float(100.0 * (1.0 - math.exp(-variance / 250.0)))
    is_blurry = variance < 80.0

    return {
        "laplacian_variance": round(variance, 2),
        "sharpness_score": round(sharpness_score, 1),
        "is_blurry": is_blurry
    }


def calculate_frequency_complexity(gray: np.ndarray) -> dict:
    """
    Computes 2D Fast Fourier Transform (FFT) energy distribution:
    Ratio of high frequency energy to total spectral energy.
    """
    # Downsample if image is huge to keep FFT fast
    h, w = gray.shape
    max_dim = 1024
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img_for_fft = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        img_for_fft = gray

    f = np.fft.fft2(img_for_fft.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift) ** 2
    
    cy, cx = fshift.shape[0] // 2, fshift.shape[1] // 2
    y, x = np.ogrid[:fshift.shape[0], :fshift.shape[1]]
    dist_from_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    max_dist = np.sqrt(cx ** 2 + cy ** 2)

    total_energy = float(np.sum(magnitude))
    if total_energy <= 1e-9:
        return {"high_freq_ratio": 0.0, "spectral_energy_score": 0.0}

    # High frequencies: > 35% radius from center
    high_freq_mask = dist_from_center > (0.35 * max_dist)
    high_freq_energy = float(np.sum(magnitude[high_freq_mask]))
    high_freq_ratio = (high_freq_energy / total_energy) * 100.0

    return {
        "high_freq_ratio": round(high_freq_ratio, 2),
        "spectral_energy_score": round(min(100.0, high_freq_ratio * 4.0), 1)
    }


def detect_jpeg_chroma_subsampling(raw_bytes: bytes) -> str:
    """
    Parses JPEG SOF0 (0xFFC0) / SOF2 (0xFFC2) markers to extract chroma subsampling:
    4:4:4, 4:2:2, 4:2:0, or 4:0:0 (grayscale).
    """
    try:
        offset = 0
        if len(raw_bytes) < 4 or raw_bytes[0:2] != b'\xff\xd8':
            return "N/A (Non-JPEG)"

        offset = 2
        while offset < len(raw_bytes) - 4:
            marker, length = struct.unpack(">HH", raw_bytes[offset:offset+4])
            if marker in (0xFFC0, 0xFFC2):  # Baseline DCT or Progressive DCT
                # SOF segment format:
                # 2 bytes marker, 2 bytes length, 1 byte precision, 2 bytes height, 2 bytes width, 1 byte components
                comp_count = raw_bytes[offset + 9]
                if comp_count == 1:
                    return "4:0:0 (Monochrome)"
                elif comp_count == 3:
                    # Next components: ID(1B), Subsampling(1B: 4bit H, 4bit V), QuantTableID(1B)
                    y_samp = raw_bytes[offset + 11]
                    cb_samp = raw_bytes[offset + 14]
                    cr_samp = raw_bytes[offset + 17]

                    y_h, y_v = (y_samp >> 4) & 0x0F, y_samp & 0x0F
                    cb_h, cb_v = (cb_samp >> 4) & 0x0F, cb_samp & 0x0F
                    cr_h, cr_v = (cr_samp >> 4) & 0x0F, cr_samp & 0x0F

                    if y_h == 2 and y_v == 2 and cb_h == 1 and cb_v == 1 and cr_h == 1 and cr_v == 1:
                        return "4:2:0 (Standard Web Subsampling)"
                    elif y_h == 2 and y_v == 1 and cb_h == 1 and cb_v == 1 and cr_h == 1 and cr_v == 1:
                        return "4:2:2 (Horizontal Subsampling)"
                    elif y_h == 1 and y_v == 1 and cb_h == 1 and cb_v == 1 and cr_h == 1 and cr_v == 1:
                        return "4:4:4 (No Chroma Subsampling)"
                    else:
                        return f"Custom ({y_h}x{y_v}, {cb_h}x{cb_v}, {cr_h}x{cr_v})"
                break
            offset += 2 + length
    except Exception:
        pass
    return "Unknown"


def inspect_color_profile(pil_img: Image.Image) -> dict:
    """
    Extracts embedded ICC color profile information and color space name.
    """
    icc = pil_img.info.get("icc_profile")
    if icc:
        try:
            profile = ImageCms.getOpenProfile(io.BytesIO(icc))
            desc = ImageCms.getProfileDescription(profile).strip()
            model = ImageCms.getProfileModel(profile).strip()
            return {
                "has_icc": True,
                "profile_name": desc or model or "Custom ICC Profile",
                "color_space": "Wide Gamut / Embedded ICC" if ("p3" in desc.lower() or "adobe" in desc.lower()) else "sRGB Profile"
            }
        except Exception:
            return {
                "has_icc": True,
                "profile_name": "Embedded ICC (Unparsed)",
                "color_space": "Custom Profile"
            }
    return {
        "has_icc": False,
        "profile_name": "Standard / Untagged (Assumed sRGB)",
        "color_space": "sRGB (Default)"
    }


def compute_histograms(img_rgb: np.ndarray, bins: int = 48) -> dict:
    """
    Calculates downsampled histograms for R, G, B channels and Luminance for fast frontend chart rendering.
    """
    # Luminance Y = 0.299 R + 0.587 G + 0.114 B
    lum = (0.299 * img_rgb[:, :, 0] + 0.587 * img_rgb[:, :, 1] + 0.114 * img_rgb[:, :, 2]).astype(np.uint8)

    r_hist = cv2.calcHist([img_rgb], [0], None, [bins], [0, 256]).flatten()
    g_hist = cv2.calcHist([img_rgb], [1], None, [bins], [0, 256]).flatten()
    b_hist = cv2.calcHist([img_rgb], [2], None, [bins], [0, 256]).flatten()
    y_hist = cv2.calcHist([lum], [0], None, [bins], [0, 256]).flatten()

    # Normalize to percentages (0..100)
    total = img_rgb.shape[0] * img_rgb.shape[1]
    return {
        "bins": bins,
        "r": [round(float(v / total * 100), 2) for v in r_hist],
        "g": [round(float(v / total * 100), 2) for v in g_hist],
        "b": [round(float(v / total * 100), 2) for v in b_hist],
        "luminance": [round(float(v / total * 100), 2) for v in y_hist]
    }


def analyze_image_full(raw_bytes: bytes, filename: str = "image.jpg") -> dict:
    """
    Master analyzer function: runs all metrics and compiles a comprehensive diagnostic report.
    """
    pil_img = Image.open(io.BytesIO(raw_bytes))
    format_name = pil_img.format or "UNKNOWN"
    original_mode = pil_img.mode
    width, height = pil_img.size
    aspect_ratio = round(width / max(1, height), 3)
    megapixels = round((width * height) / 1_000_000, 2)
    file_size_bytes = len(raw_bytes)

    # Convert to RGB numpy array
    rgb_pil = pil_img.convert("RGB")
    rgb_np = np.array(rgb_pil)
    gray_np = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2GRAY)

    # 1. Noise metrics
    noise_sigma_immerkaer = estimate_noise_immerkaer(gray_np)
    noise_sigma_donoho = estimate_noise_donoho_haar(gray_np)
    # Combined composite noise score (0..100)
    composite_noise = min(100.0, (noise_sigma_immerkaer * 0.5 + noise_sigma_donoho * 0.5) * 5.0)

    if composite_noise < 10.0:
        noise_level = "Clean / Negligible"
    elif composite_noise < 25.0:
        noise_level = "Low Noise"
    elif composite_noise < 45.0:
        noise_level = "Moderate Noise"
    else:
        noise_level = "High / Heavy Noise"

    # 2. Entropy and Complexity
    entropy = calculate_shannon_entropy(gray_np)
    spatial_info = calculate_spatial_information(gray_np)
    freq_data = calculate_frequency_complexity(gray_np)

    # Normalized complexity score (0..100)
    # Combines Shannon entropy (0..8) and Spatial Information
    complexity_score = min(100.0, ((entropy / 8.0) * 45.0 + min(55.0, spatial_info * 0.85)))

    # 3. Sharpness & Blur
    sharpness_data = calculate_sharpness_and_blur(gray_np)

    # 4. Color, Subsampling and Profile
    chroma = detect_jpeg_chroma_subsampling(raw_bytes) if format_name == "JPEG" else ("4:4:4 (Lossless/RGB Model)" if format_name in ("PNG", "WEBP") else "4:4:4 (RGB)")
    icc_data = inspect_color_profile(pil_img)

    # 5. Content Classification (Photo, Graphics, UI/Screenshot, Document)
    # Graphics/UI typically have lower unique colors ratio or very specific edge-to-entropy ratio
    unique_colors_sample = len(np.unique(rgb_np[::4, ::4].reshape(-1, 3), axis=0))
    sample_pixels = (width // 4) * (height // 4)
    color_diversity = unique_colors_sample / max(1, sample_pixels)

    if color_diversity < 0.08 and entropy < 6.8:
        content_type = "Vector / UI / Flat Graphic"
    elif sharpness_data["is_blurry"]:
        content_type = "Blurred / Soft Photo"
    elif composite_noise > 35.0:
        content_type = "Noisy Photographic Content"
    else:
        content_type = "Detailed Photographic Content"

    # 6. Histograms
    histograms = compute_histograms(rgb_np, bins=48)

    return {
        "metadata": {
            "filename": filename,
            "format": format_name,
            "original_mode": original_mode,
            "width": width,
            "height": height,
            "aspect_ratio": aspect_ratio,
            "megapixels": megapixels,
            "file_size_bytes": file_size_bytes,
            "file_size_kb": round(file_size_bytes / 1024, 1),
            "file_size_mb": round(file_size_bytes / (1024 * 1024), 2),
            "content_type": content_type
        },
        "color": {
            "chroma_subsampling": chroma,
            "color_space": icc_data["color_space"],
            "profile_name": icc_data["profile_name"],
            "has_icc": icc_data["has_icc"],
            "channels": 3 if original_mode in ("RGB", "YCbCr") else (4 if original_mode == "RGBA" else 1)
        },
        "noise": {
            "noise_score": round(composite_noise, 1),
            "noise_level": noise_level,
            "sigma_immerkaer": round(noise_sigma_immerkaer, 2),
            "sigma_donoho_haar": round(noise_sigma_donoho, 2),
            "needs_denoising": composite_noise > 22.0
        },
        "complexity": {
            "complexity_score": round(complexity_score, 1),
            "entropy_bits": round(entropy, 2),
            "spatial_information": round(spatial_info, 2),
            "high_freq_ratio": freq_data["high_freq_ratio"],
            "spectral_energy_score": freq_data["spectral_energy_score"]
        },
        "sharpness": sharpness_data,
        "histograms": histograms
    }
