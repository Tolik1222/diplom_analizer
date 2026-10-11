import numpy as np
from app.analyzer.metrics import (
    estimate_noise_immerkaer,
    estimate_noise_donoho_haar,
    estimate_noise_dct_highfreq,
    estimate_image_noise_sigma,
    analyze_image_full,
)
from PIL import Image
import io


def _png_bytes(arr):
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def _add_noise(base, sigma, rng):
    return np.clip(base + rng.normal(0, sigma, base.shape), 0, 255).astype(np.uint8)


def test_awgn_flat_sigma8():
    rng = np.random.default_rng(0)
    img = _add_noise(np.full((256, 256), 128.0), 8.0, rng)
    sigma = estimate_noise_dct_highfreq(img)
    assert 7.2 <= sigma <= 8.8, sigma


def test_textured_baboon_like_closer_than_global():
    rng = np.random.default_rng(1)
    yy, xx = np.mgrid[0:512, 0:512]
    fur = (32 * np.sin(xx / 2.2) + 28 * np.sin(yy / 1.7) + ((xx * 9 + yy * 5) % 40)).astype(np.float64)
    clean = np.clip(100 + fur, 0, 255)
    noisy = _add_noise(clean, 8.0, rng)
    global_mix = 0.5 * (estimate_noise_immerkaer(noisy) + estimate_noise_donoho_haar(noisy))
    dct_s = estimate_noise_dct_highfreq(noisy)
    assert dct_s < global_mix, (dct_s, global_mix)
    assert 7.0 <= dct_s <= 10.5, dct_s


def test_color_independent_noise_not_y_mixed():
    rng = np.random.default_rng(3)
    yy, xx = np.mgrid[0:256, 0:256]
    smooth = 110 + 18 * (yy / 256.0) + 12 * (xx / 256.0)
    rgb = np.stack([smooth, smooth + 8, smooth - 6], axis=2)
    noisy = np.zeros_like(rgb, dtype=np.uint8)
    for c in range(3):
        noisy[:, :, c] = _add_noise(rgb[:, :, c], 8.0, rng)
    sigma = estimate_image_noise_sigma(noisy, noisy[:, :, 1], "RGB")
    assert 6.8 <= sigma <= 9.5, sigma


def test_gray_as_rgb_matches_luma():
    rng = np.random.default_rng(4)
    g = _add_noise(np.full((256, 256), 120.0), 10.0, rng)
    rgb = np.stack([g, g, g], axis=2)
    sigma = estimate_image_noise_sigma(rgb, g, "RGB")
    assert 8.5 <= sigma <= 11.5, sigma


def test_analyze_gray_and_color_pipeline():
    rng = np.random.default_rng(5)
    g = _add_noise(np.full((192, 192), 128.0), 8.0, rng)
    gray3 = np.stack([g, g, g], axis=2)
    res_g = analyze_image_full(_png_bytes(gray3), filename="noised_frisco_gray_8.png")
    assert 6.8 <= res_g["noise"]["sigma"] <= 9.5, res_g["noise"]

    yy, xx = np.mgrid[0:192, 0:192]
    base = 100 + 20 * (xx / 192.0)
    rgb = np.stack([base, base + 10, base - 8], axis=2)
    noisy = np.empty_like(rgb, dtype=np.uint8)
    for c in range(3):
        noisy[:, :, c] = _add_noise(rgb[:, :, c], 8.0, rng)
    res_c = analyze_image_full(_png_bytes(noisy.astype(np.uint8)), filename="noised_lena_8.png")
    assert 6.8 <= res_c["noise"]["sigma"] <= 9.8, res_c["noise"]
    assert res_c["noise"]["estimated_on"] == "rgb_channels"


if __name__ == "__main__":
    test_awgn_flat_sigma8()
    test_textured_baboon_like_closer_than_global()
    test_color_independent_noise_not_y_mixed()
    test_gray_as_rgb_matches_luma()
    test_analyze_gray_and_color_pipeline()
    print("noise tests OK")
