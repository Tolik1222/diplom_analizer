import numpy as np
from app.analyzer.research_codecs import encode_research_codec, decode_research_codec, qp_to_qstep
from app.analyzer.optimizer import execute_optimization
from PIL import Image
import io


def _rgb(h=64, w=80):
    yy, xx = np.mgrid[0:h, 0:w]
    img = np.stack([
        (xx * 3) % 256,
        (yy * 5) % 256,
        ((xx + yy) * 2) % 256
    ], axis=2).astype(np.uint8)
    return img


def test_bpg_q_range_and_extremes():
    rgb = _rgb()
    _, recon_lo, info_lo = encode_research_codec(rgb, "BPG", 1, chroma="4:4:4")
    _, recon_hi, info_hi = encode_research_codec(rgb, "BPG", 51, chroma="4:2:0")
    assert info_lo["pcc"] == 1
    assert info_hi["pcc"] == 51
    mse_lo = np.mean((rgb.astype(float) - recon_lo.astype(float)) ** 2)
    mse_hi = np.mean((rgb.astype(float) - recon_hi.astype(float)) ** 2)
    assert mse_hi > mse_lo
    assert qp_to_qstep(51) > qp_to_qstep(25)


def test_agu_qs_roundtrip_decode():
    rgb = _rgb()
    bitstream, recon, info = encode_research_codec(rgb, "AGU", 8, chroma="4:2:0")
    decoded = decode_research_codec(bitstream)
    assert decoded.shape == rgb.shape
    assert np.mean(np.abs(decoded.astype(int) - recon.astype(int))) < 2
    assert info["bitstream_bytes"] > 32


def test_optimizer_manual_jpeg_chroma_and_q1():
    buf = io.BytesIO()
    Image.fromarray(_rgb(48, 48)).save(buf, format="PNG")
    raw = buf.getvalue()
    result = execute_optimization(raw, {
        "recommended_format": "JPEG",
        "recommended_quality": 1,
        "is_lossless": False,
        "chroma_subsampling": "4:4:4",
        "denoise_filter": "none",
    })
    assert result["format"] == "JPEG"
    assert result["quality_applied"] == 1
    assert result["chroma_subsampling"] == "4:4:4"
    assert result["pcc_name"] == "Q"


def test_optimizer_bpg_q50():
    buf = io.BytesIO()
    Image.fromarray(_rgb(48, 48)).save(buf, format="PNG")
    raw = buf.getvalue()
    result = execute_optimization(raw, {
        "recommended_format": "BPG",
        "recommended_quality": 50,
        "is_lossless": False,
        "chroma_subsampling": "4:2:0",
        "denoise_filter": "none",
    })
    assert result["pcc_name"] == "Q"
    assert result["pcc_value"] == 50
    assert result["extension"] == "bpg"


if __name__ == "__main__":
    test_bpg_q_range_and_extremes()
    test_agu_qs_roundtrip_decode()
    test_optimizer_manual_jpeg_chroma_and_q1()
    test_optimizer_bpg_q50()
    print("research codec tests OK")
