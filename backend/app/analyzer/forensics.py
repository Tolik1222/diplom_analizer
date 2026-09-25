import io
import math
import base64
import numpy as np
import cv2
from PIL import Image, ImageOps
from typing import Dict, Any, List, Tuple


def _to_base64_jpeg(img_rgb: np.ndarray, quality: int = 90) -> str:
    """Encodes RGB numpy array to base64 JPEG data URL."""
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    success, buffer = cv2.imencode('.jpg', img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64}"


def _to_base64_png(img_rgb: np.ndarray) -> str:
    """Encodes RGB numpy array to base64 PNG data URL."""
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    success, buffer = cv2.imencode('.png', img_bgr)
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def compute_ela(raw_bytes: bytes, scale: float = 15.0, resave_quality: int = 95) -> str:
    """
    1. Error Level Analysis (ELA):
    Re-compresses image at a known quality level (e.g. 95) and computes the absolute
    difference between original and recompressed pixels, scaled to make compression differences visible.
    """
    orig_pil = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    orig_np = np.array(orig_pil)

    # Re-save to memory JPEG
    temp_buf = io.BytesIO()
    orig_pil.save(temp_buf, format="JPEG", quality=resave_quality)
    temp_buf.seek(0)
    resaved_pil = Image.open(temp_buf).convert("RGB")
    resaved_np = np.array(resaved_pil)

    # Calculate absolute difference and amplify
    diff = cv2.absdiff(orig_np, resaved_np).astype(np.float32)
    ela_np = np.clip(diff * scale, 0, 255).astype(np.uint8)

    return _to_base64_jpeg(ela_np)


def compute_noise_analysis(img_rgb: np.ndarray) -> str:
    """
    2. Noise Analysis:
    Applies high-pass residual filter (subtracting median or Gaussian blur)
    and visualizes noise distribution with contrast stretching and colormap.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    noise_residual = cv2.absdiff(gray, blurred)
    
    # Contrast stretch noise
    noise_stretched = cv2.normalize(noise_residual, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    # Apply thermal/inferno-style colormap for visual forensics
    colored_noise = cv2.applyColorMap(noise_stretched, cv2.COLORMAP_INFERNO)
    noise_rgb = cv2.cvtColor(colored_noise, cv2.COLOR_BGR2RGB)
    return _to_base64_jpeg(noise_rgb)


def compute_luminance_gradient(img_rgb: np.ndarray) -> str:
    """
    3. Luminance Gradient:
    Computes spatial lighting and illumination changes across the scene
    using Sobel gradient magnitude on luminance with a Viridis color palette.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
    mag_norm = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    
    colored_grad = cv2.applyColorMap(mag_norm, cv2.COLORMAP_VIRIDIS)
    return _to_base64_jpeg(cv2.cvtColor(colored_grad, cv2.COLOR_BGR2RGB))


def compute_level_sweep(img_rgb: np.ndarray, sweep_step: int = 16) -> str:
    """
    4. Level Sweep:
    Quantizes luminance into distinct bands/contours to expose contouring,
    gradient posterization, and illumination consistency.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    # Quantize into distinct levels
    quantized = (gray // sweep_step) * sweep_step
    colored = cv2.applyColorMap(quantized, cv2.COLORMAP_JET)
    return _to_base64_jpeg(cv2.cvtColor(colored, cv2.COLOR_BGR2RGB))


def compute_pca_color(img_rgb: np.ndarray) -> str:
    """
    5. Principal Component Analysis (PCA):
    Deconstructs RGB pixel distribution into 3 orthogonal principal axes,
    mapping the 1st, 2nd, and 3rd components to contrast-enhanced RGB channels.
    """
    h, w, c = img_rgb.shape
    pixels = img_rgb.reshape(-1, 3).astype(np.float32)
    
    # Center the data
    mean = np.mean(pixels, axis=0)
    centered = pixels - mean
    
    # Compute covariance and eigenvectors
    cov = np.cov(centered, rowvar=False)
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    
    # Sort eigenvectors in descending order
    idx = np.argsort(eigenvalues)[::-1]
    eigenvectors = eigenvectors[:, idx]
    
    # Project pixels onto principal components
    projected = np.dot(centered, eigenvectors)
    
    # Normalize each component to 0-255
    pca_img = np.zeros_like(projected)
    for i in range(3):
        comp = projected[:, i]
        min_val, max_val = comp.min(), comp.max()
        if max_val > min_val:
            pca_img[:, i] = (comp - min_val) / (max_val - min_val) * 255.0
        else:
            pca_img[:, i] = 128
            
    pca_rgb = pca_img.reshape(h, w, 3).astype(np.uint8)
    return _to_base64_jpeg(pca_rgb)


def compute_edge_detection(img_rgb: np.ndarray) -> str:
    """
    6. Edge Detection:
    Multi-scale Canny edge detection highlighting physical structure and boundaries.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    # Automatic Canny thresholds based on median
    med = np.median(gray)
    lower = int(max(0, (1.0 - 0.33) * med))
    upper = int(min(255, (1.0 + 0.33) * med))
    edges = cv2.Canny(gray, lower, upper)
    
    # Render edges on dark background with cyan glow
    edge_rgb = np.zeros((edges.shape[0], edges.shape[1], 3), dtype=np.uint8)
    edge_rgb[edges > 0] = [6, 182, 212]  # Cyan
    return _to_base64_png(edge_rgb)


def compute_histogram_equalize(img_rgb: np.ndarray) -> str:
    """
    7. Histogram Equalization (CLAHE):
    Applies Contrast Limited Adaptive Histogram Equalization on the luminance channel
    in LAB color space to recover extreme hidden details in shadows and highlights.
    """
    lab = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    eq_rgb = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
    return _to_base64_jpeg(eq_rgb)


def compute_channel_isolation(img_rgb: np.ndarray, channel: str = "red") -> str:
    """
    8. Channel Isolation:
    Isolates single channels (Red, Green, Blue, or Luminance Y, Cb, Cr).
    """
    ch = channel.lower()
    h, w, _ = img_rgb.shape
    out = np.zeros((h, w, 3), dtype=np.uint8)

    if ch == "red":
        out[:, :, 0] = img_rgb[:, :, 0]
    elif ch == "green":
        out[:, :, 1] = img_rgb[:, :, 1]
    elif ch == "blue":
        out[:, :, 2] = img_rgb[:, :, 2]
    elif ch == "luma":
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        out = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    elif ch == "cb":
        ycrcb = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2YCrCb)
        out = cv2.applyColorMap(ycrcb[:, :, 2], cv2.COLORMAP_WINTER)
        out = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    elif ch == "cr":
        ycrcb = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2YCrCb)
        out = cv2.applyColorMap(ycrcb[:, :, 1], cv2.COLORMAP_AUTUMN)
        out = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    else:
        out = img_rgb

    return _to_base64_jpeg(out)


def compute_bit_plane(img_rgb: np.ndarray, bit_index: int = 0) -> str:
    """
    9. Bit-Plane (LSB / MSB) Analysis:
    Extracts bit plane (0 to 7). Bit 0 is Least Significant Bit (LSB),
    crucial for steganography detection and digital watermarking.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    bit_plane = (gray >> bit_index) & 1
    visual = (bit_plane * 255).astype(np.uint8)
    visual_rgb = cv2.cvtColor(visual, cv2.COLOR_GRAY2RGB)
    return _to_base64_png(visual_rgb)


def compute_clone_detection(img_rgb: np.ndarray) -> Tuple[str, int]:
    """
    10. Clone / Copy-Move Forgery Detection:
    Uses block-matching or keypoint feature matching (ORB/AKAZE) with RANSAC
    to detect duplicate cloned regions within the same image.
    """
    h, w, _ = img_rgb.shape
    # Scale down if large for fast responsive execution
    max_dim = 800
    scale = 1.0
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        working_img = cv2.resize(img_rgb, (int(w * scale), int(h * scale)))
    else:
        working_img = img_rgb.copy()

    gray = cv2.cvtColor(working_img, cv2.COLOR_RGB2GRAY)
    
    # Detect ORB keypoints and descriptors
    orb = cv2.ORB_create(nfeatures=1200)
    keypoints, descriptors = orb.detectAndCompute(gray, None)

    clone_canvas = working_img.copy()
    match_count = 0

    if descriptors is not None and len(keypoints) > 10:
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        matches = bf.knnMatch(descriptors, descriptors, k=3)
        
        valid_pairs = []
        for m_list in matches:
            if len(m_list) >= 3:
                m1, m2, m3 = m_list[0], m_list[1], m_list[2]
                # Filter out self-match (distance 0 at same location)
                candidate = m2 if m1.queryIdx == m1.trainIdx else m1
                pt1 = np.array(keypoints[candidate.queryIdx].pt)
                pt2 = np.array(keypoints[candidate.trainIdx].pt)
                spatial_dist = np.linalg.norm(pt1 - pt2)
                
                # Check spatial distance (avoid immediately neighboring pixels)
                # and descriptor similarity threshold
                if spatial_dist > 30 and candidate.distance < 45:
                    valid_pairs.append((pt1, pt2))

        match_count = len(valid_pairs)
        # Draw connection lines between cloned spots
        for pt1, pt2 in valid_pairs[:50]:
            p1 = (int(pt1[0]), int(pt1[1]))
            p2 = (int(pt2[0]), int(pt2[1]))
            cv2.line(clone_canvas, p1, p2, (244, 63, 94), 2)  # Pink/Red link
            cv2.circle(clone_canvas, p1, 5, (16, 185, 129), -1)  # Green anchor
            cv2.circle(clone_canvas, p2, 5, (6, 182, 212), -1)  # Cyan clone

    return _to_base64_jpeg(clone_canvas), match_count


def generate_forensic_mode(raw_bytes: bytes, mode: str, extra_param: str = "") -> Dict[str, Any]:
    """
    Executes the specified forensic analysis mode and returns visual data URL with metadata.
    """
    orig_pil = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    orig_np = np.array(orig_pil)

    mode_lower = mode.lower()

    if mode_lower == "ela" or "error" in mode_lower:
        data_url = compute_ela(raw_bytes, scale=15.0)
        title = "Error Level Analysis (ELA)"
        desc = "Виявлення областей з різними коефіцієнтами стиснення. Яскравіші ділянки сигналізують про можливий фотомонтаж або склейку."
    elif mode_lower == "noise":
        data_url = compute_noise_analysis(orig_np)
        title = "Noise Analysis (Аналіз шуму)"
        desc = "Спектральна карта залишкового високочастотного шуму. Дозволяє виявити неоднорідності шуму матриці камери або дофотошоплені об'єкти."
    elif "gradient" in mode_lower or "luminance" in mode_lower:
        data_url = compute_luminance_gradient(orig_np)
        title = "Luminance Gradient (Градієнт освітлення)"
        desc = "Векторні перепади освітлення у просторі Viridis. Виявляє напрямок джерела світла та порушення тіней."
    elif "sweep" in mode_lower:
        step = int(extra_param) if extra_param.isdigit() else 16
        data_url = compute_level_sweep(orig_np, sweep_step=step)
        title = "Level Sweep (Покрокове квантування)"
        desc = "Розбиття динамічного діапазону на ізолінії для виявлення прихованого ступінчастого квантування та постерізації."
    elif "pca" in mode_lower:
        data_url = compute_pca_color(orig_np)
        title = "Principal Component Analysis (PCA)"
        desc = "Розкладання тривимірного колірного простору на некорельовані ортогональні компоненти для максимального контрастування деталей."
    elif "edge" in mode_lower:
        data_url = compute_edge_detection(orig_np)
        title = "Edge Detection (Контурний аналіз Canny)"
        desc = "Виділення геометричних граней та мікротекстур, інваріантних до колірних градієнтів."
    elif "equalize" in mode_lower or "clahe" in mode_lower:
        data_url = compute_histogram_equalize(orig_np)
        title = "Histogram Equalize (Адаптивна еквалізація CLAHE)"
        desc = "Локальне вирівнювання гістограми яскравості: виявляє приховану інформацію в глибоких тінях та пересвічених ділянках."
    elif "channel" in mode_lower:
        ch = extra_param or "red"
        data_url = compute_channel_isolation(orig_np, channel=ch)
        title = f"Channel Isolation ({ch.upper()})"
        desc = f"Ізольований аналіз окремого каналу {ch.upper()} для інспекції колірних шумів та артефактів субдискретизації."
    elif "bit" in mode_lower or "lsb" in mode_lower:
        bit = int(extra_param) if extra_param.isdigit() else 0
        data_url = compute_bit_plane(orig_np, bit_index=bit)
        title = f"Bit-Plane Analysis (Біт #{bit} - {'LSB (Стеганографія)' if bit == 0 else ('MSB' if bit == 7 else 'Рівень ' + str(bit))})"
        desc = "Аналіз окремих бітових зрізів. Молодший біт (LSB bit 0) використовується для виявлення цифрових водяних знаків та прихованої інформації."
    elif "clone" in mode_lower:
        data_url, count = compute_clone_detection(orig_np)
        title = f"Clone Detection (Детекція клонування/копіювання: {count} зв'язків)"
        desc = "Виявлення дубльованих паттернів та спроб ретуші методом 'Clone Stamp' / замазування штампом."
    else:
        # Default original
        data_url = _to_base64_jpeg(orig_np)
        title = "Original"
        desc = "Вихідне немодифіковане зображення."

    return {
        "mode": mode,
        "title": title,
        "description": desc,
        "data_url": data_url
    }
