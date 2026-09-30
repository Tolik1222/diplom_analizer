"""
Research implementations of department codecs used for still-image studies:

* AGU  — DCT 32×32, uniform quantization step QS, deblocking
         (Ponomarenko, Lukin, Egiazarian, Astola, SCIA 2005)
* ADCT — same QS control with a simplified adaptive partition scheme
         (Ponomarenko et al., IEEE SPL 2007 / ADCTC)
* BPG  — HEVC-style intra transform coding with integer Q in {1..51}
         (Bellard; larger Q → stronger compression, as in KHAI papers)

These produce research bitstreams (not bit-identical to the original
Windows executables / libbpg) so PSNR/SSIM vs CR can be measured for any
QS/Q, including extreme values. Reconstructs 8-bit RGB for preview.
"""
from __future__ import annotations

import io
import struct
import zlib
from typing import Dict, Tuple

import cv2
import numpy as np
from scipy.fft import dctn, idctn

MAGIC = b"OMRC"
VERSION = 1
CODEC_AGU = 1
CODEC_ADCT = 2
CODEC_BPG = 3

CHROMA_IDS = {"4:4:4": 0, "4:2:2": 1, "4:2:0": 2}
CHROMA_NAMES = {0: "4:4:4", 1: "4:2:2", 2: "4:2:0"}


def _to_ycbcr(rgb: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb).astype(np.float64)
    y = ycrcb[:, :, 0]
    cr = ycrcb[:, :, 1]
    cb = ycrcb[:, :, 2]
    return y, cb, cr


def _from_ycbcr(y: np.ndarray, cb: np.ndarray, cr: np.ndarray, h: int, w: int) -> np.ndarray:
    y = np.clip(y[:h, :w], 0, 255)
    cb = np.clip(cb[:h, :w], 0, 255)
    cr = np.clip(cr[:h, :w], 0, 255)
    stacked = np.stack([y, cr, cb], axis=2).astype(np.uint8)
    return cv2.cvtColor(stacked, cv2.COLOR_YCrCb2RGB)


def _chroma_down(cb: np.ndarray, cr: np.ndarray, chroma: str) -> Tuple[np.ndarray, np.ndarray]:
    h, w = cb.shape
    if chroma == "4:4:4":
        return cb, cr
    if chroma == "4:2:2":
        nw = max(1, (w + 1) // 2)
        return (
            cv2.resize(cb, (nw, h), interpolation=cv2.INTER_AREA),
            cv2.resize(cr, (nw, h), interpolation=cv2.INTER_AREA),
        )
    nw = max(1, (w + 1) // 2)
    nh = max(1, (h + 1) // 2)
    return (
        cv2.resize(cb, (nw, nh), interpolation=cv2.INTER_AREA),
        cv2.resize(cr, (nw, nh), interpolation=cv2.INTER_AREA),
    )


def _chroma_up(cb: np.ndarray, cr: np.ndarray, h: int, w: int) -> Tuple[np.ndarray, np.ndarray]:
    if cb.shape == (h, w):
        return cb, cr
    return (
        cv2.resize(cb, (w, h), interpolation=cv2.INTER_LINEAR),
        cv2.resize(cr, (w, h), interpolation=cv2.INTER_LINEAR),
    )


def _block_grid(channel: np.ndarray, bs: int) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    h, w = channel.shape
    ph = ((h + bs - 1) // bs) * bs
    pw = ((w + bs - 1) // bs) * bs
    pad = np.pad(channel, ((0, ph - h), (0, pw - w)), mode="edge")
    nh, nw = ph // bs, pw // bs
    blocks = pad.reshape(nh, bs, nw, bs).swapaxes(1, 2)
    return blocks, (h, w, ph, pw)


def _from_blocks(blocks: np.ndarray, meta: Tuple[int, int, int, int], bs: int) -> np.ndarray:
    h, w, ph, pw = meta
    nh, nw = ph // bs, pw // bs
    recon = blocks.swapaxes(1, 2).reshape(ph, pw)
    return recon[:h, :w]


def _dct_blocks(blocks: np.ndarray) -> np.ndarray:
    return dctn(blocks, type=2, norm="ortho", axes=(-2, -1))


def _idct_blocks(coeffs: np.ndarray) -> np.ndarray:
    return idctn(coeffs, type=2, norm="ortho", axes=(-2, -1))


def _pack_array(arr: np.ndarray) -> bytes:
    header = struct.pack("<BIIII", arr.ndim, *list(arr.shape) + [1, 1, 1][: 4 - arr.ndim])
    dtype_code = {np.dtype("int16"): 1, np.dtype("uint8"): 2, np.dtype("float32"): 3}[arr.dtype]
    payload = arr.tobytes()
    return struct.pack("<B", dtype_code) + header + payload


def _unpack_array(buf: bytes, offset: int) -> Tuple[np.ndarray, int]:
    dtype_code = buf[offset]
    offset += 1
    ndim, s0, s1, s2, s3 = struct.unpack_from("<BIIII", buf, offset)
    offset += 17
    shape = (s0, s1, s2, s3)[:ndim]
    dtype = {1: np.int16, 2: np.uint8, 3: np.float32}[dtype_code]
    n = int(np.prod(shape))
    nbytes = n * np.dtype(dtype).itemsize
    arr = np.frombuffer(buf, dtype=dtype, count=n, offset=offset).reshape(shape).copy()
    return arr, offset + nbytes


def _deblock(img: np.ndarray, bs: int = 32, strength: float = 0.35) -> np.ndarray:
    """Light AGU-style boundary smoothing."""
    out = img.copy()
    h, w = out.shape
    for x in range(bs, w, bs):
        left = out[:, x - 1]
        right = out[:, x]
        avg = (left + right) * 0.5
        out[:, x - 1] = left * (1 - strength) + avg * strength
        out[:, x] = right * (1 - strength) + avg * strength
    for y in range(bs, h, bs):
        top = out[y - 1, :]
        bot = out[y, :]
        avg = (top + bot) * 0.5
        out[y - 1, :] = top * (1 - strength) + avg * strength
        out[y, :] = bot * (1 - strength) + avg * strength
    return out


def _encode_plane_dct(plane: np.ndarray, qs: float, bs: int, lossless: bool) -> Tuple[bytes, np.ndarray]:
    if lossless:
        packed = _pack_array(np.rint(plane).astype(np.int16))
        return packed, plane.copy()
    qs = max(float(qs), 0.05)
    blocks, meta = _block_grid(plane - 128.0, bs)
    coeffs = _dct_blocks(blocks)
    q = np.rint(coeffs / qs).astype(np.int16)
    recon = _idct_blocks(q.astype(np.float64) * qs)
    rec_plane = _from_blocks(recon, meta, bs) + 128.0
    packed = _pack_array(q) + struct.pack("<IIII", *meta)
    return packed, rec_plane


def _decode_plane_dct(buf: bytes, offset: int, qs: float, bs: int, lossless: bool) -> Tuple[np.ndarray, int]:
    arr, offset = _unpack_array(buf, offset)
    if lossless:
        return arr.astype(np.float64), offset
    h, w, ph, pw = struct.unpack_from("<IIII", buf, offset)
    offset += 16
    nh, nw = ph // bs, pw // bs
    q = arr.reshape(nh, nw, bs, bs).astype(np.float64)
    recon = _idct_blocks(q * max(float(qs), 0.05))
    rec_plane = _from_blocks(recon, (h, w, ph, pw), bs) + 128.0
    return rec_plane, offset


def _adct_encode_plane(plane: np.ndarray, qs: float, lossless: bool) -> Tuple[bytes, np.ndarray]:
    """Adaptive 32/16/8 partition on local variance; same QS as ADCTC papers."""
    if lossless:
        return _encode_plane_dct(plane, qs, 32, True)

    qs = max(float(qs), 0.05)
    bs = 32
    blocks, meta = _block_grid(plane - 128.0, bs)
    nh, nw = blocks.shape[:2]
    rec = np.zeros_like(blocks)
    parts = np.zeros((nh, nw), dtype=np.uint8)
    blobs = []

    var = np.var(blocks, axis=(-2, -1))
    for i in range(nh):
        for j in range(nw):
            block = blocks[i, j]
            v = float(var[i, j])
            if v < 80.0:
                parts[i, j] = 0
                c = _dct_blocks(block[None, None])[0, 0]
                q = np.rint(c / qs).astype(np.int16)
                blobs.append(_pack_array(q))
                rec[i, j] = _idct_blocks((q.astype(np.float64) * qs)[None, None])[0, 0]
            elif v < 400.0:
                parts[i, j] = 1
                sub = block.reshape(2, 16, 2, 16).swapaxes(1, 2)
                c = _dct_blocks(sub)
                q = np.rint(c / qs).astype(np.int16)
                blobs.append(_pack_array(q))
                rec[i, j] = _idct_blocks(q.astype(np.float64) * qs).swapaxes(1, 2).reshape(32, 32)
            else:
                parts[i, j] = 2
                sub = block.reshape(4, 8, 4, 8).swapaxes(1, 2)
                c = _dct_blocks(sub)
                q = np.rint(c / qs).astype(np.int16)
                blobs.append(_pack_array(q))
                rec[i, j] = _idct_blocks(q.astype(np.float64) * qs).swapaxes(1, 2).reshape(32, 32)

    rec_plane = _from_blocks(rec, meta, bs) + 128.0
    payload = _pack_array(parts) + struct.pack("<IIII", *meta) + b"".join(blobs)
    return payload, rec_plane


def _adct_decode_plane(buf: bytes, offset: int, qs: float, lossless: bool) -> Tuple[np.ndarray, int]:
    if lossless:
        return _decode_plane_dct(buf, offset, qs, 32, True)
    parts, offset = _unpack_array(buf, offset)
    h, w, ph, pw = struct.unpack_from("<IIII", buf, offset)
    offset += 16
    qs = max(float(qs), 0.05)
    nh, nw = ph // 32, pw // 32
    rec = np.zeros((nh, nw, 32, 32), dtype=np.float64)
    for i in range(nh):
        for j in range(nw):
            q, offset = _unpack_array(buf, offset)
            p = int(parts[i, j])
            if p == 0:
                rec[i, j] = _idct_blocks((q.astype(np.float64) * qs)[None, None])[0, 0]
            elif p == 1:
                rec[i, j] = _idct_blocks(q.astype(np.float64) * qs).swapaxes(1, 2).reshape(32, 32)
            else:
                rec[i, j] = _idct_blocks(q.astype(np.float64) * qs).swapaxes(1, 2).reshape(32, 32)
    rec_plane = _from_blocks(rec, (h, w, ph, pw), 32) + 128.0
    return rec_plane, offset


def qp_to_qstep(qp: int) -> float:
    """HEVC/BPG-like mapping: larger Q → larger step → more compression."""
    qp = int(np.clip(qp, 1, 51))
    return 0.625 * (2.0 ** (qp / 6.0))


def _bpg_encode_plane(plane: np.ndarray, qp: int, lossless: bool) -> Tuple[bytes, np.ndarray]:
    """8×8 DCT + DC intra, quantized with HEVC Qstep(Q)."""
    if lossless:
        return _encode_plane_dct(plane, 1.0, 8, True)
    qstep = qp_to_qstep(qp)
    bs = 8
    blocks, meta = _block_grid(plane - 128.0, bs)
    dc = np.mean(blocks, axis=(-2, -1), keepdims=True)
    ac = blocks - dc
    coeffs = _dct_blocks(ac)
    q = np.rint(coeffs / qstep).astype(np.int16)
    dc_q = np.rint(dc[:, :, 0, 0] / qstep).astype(np.int16)
    ac_rec = _idct_blocks(q.astype(np.float64) * qstep)
    rec = ac_rec + (dc_q.astype(np.float64) * qstep)[:, :, None, None]
    rec_plane = _from_blocks(rec, meta, bs) + 128.0
    packed = _pack_array(q) + _pack_array(dc_q) + struct.pack("<IIII", *meta)
    return packed, rec_plane


def _bpg_decode_plane(buf: bytes, offset: int, qp: int, lossless: bool) -> Tuple[np.ndarray, int]:
    if lossless:
        return _decode_plane_dct(buf, offset, 1.0, 8, True)
    q, offset = _unpack_array(buf, offset)
    dc_q, offset = _unpack_array(buf, offset)
    h, w, ph, pw = struct.unpack_from("<IIII", buf, offset)
    offset += 16
    qstep = qp_to_qstep(qp)
    ac_rec = _idct_blocks(q.astype(np.float64) * qstep)
    rec = ac_rec + (dc_q.astype(np.float64) * qstep)[:, :, None, None]
    rec_plane = _from_blocks(rec, (h, w, ph, pw), 8) + 128.0
    return rec_plane, offset


def _wrap_container(codec_id: int, w: int, h: int, chroma_id: int, lossless: bool, pcc: float, payload: bytes) -> bytes:
    pcc_milli = int(round(float(pcc) * 1000))
    header = struct.pack(
        "<4sBBIIBBI",
        MAGIC,
        VERSION,
        codec_id,
        w,
        h,
        chroma_id,
        1 if lossless else 0,
        pcc_milli & 0xFFFFFFFF,
    )
    return header + zlib.compress(payload, 9)


def _unwrap_container(data: bytes) -> Dict:
    magic, ver, codec_id, w, h, chroma_id, lossless, pcc_milli = struct.unpack_from("<4sBBIIBBI", data, 0)
    if magic != MAGIC:
        raise ValueError("Unknown research-codec container")
    payload = zlib.decompress(data[20:])
    return {
        "version": ver,
        "codec_id": codec_id,
        "width": w,
        "height": h,
        "chroma": CHROMA_NAMES.get(chroma_id, "4:2:0"),
        "lossless": bool(lossless),
        "pcc": pcc_milli / 1000.0,
        "payload": payload,
    }


def encode_research_codec(
    rgb: np.ndarray,
    codec: str,
    pcc: float,
    chroma: str = "4:2:0",
    lossless: bool = False,
) -> Tuple[bytes, np.ndarray, Dict]:
    codec = codec.upper()
    chroma = chroma if chroma in CHROMA_IDS else "4:2:0"
    h, w = rgb.shape[:2]
    y, cb, cr = _to_ycbcr(rgb)
    cb_d, cr_d = _chroma_down(cb, cr, chroma if not lossless else "4:4:4")
    used_chroma = "4:4:4" if lossless else chroma

    if codec == "AGU":
        codec_id = CODEC_AGU
        y_b, y_r = _encode_plane_dct(y, pcc, 32, lossless)
        cb_b, cb_r = _encode_plane_dct(cb_d, pcc, 32, lossless)
        cr_b, cr_r = _encode_plane_dct(cr_d, pcc, 32, lossless)
        if not lossless:
            y_r = _deblock(y_r, 32)
    elif codec == "ADCT":
        codec_id = CODEC_ADCT
        y_b, y_r = _adct_encode_plane(y, pcc, lossless)
        cb_b, cb_r = _adct_encode_plane(cb_d, pcc, lossless)
        cr_b, cr_r = _adct_encode_plane(cr_d, pcc, lossless)
    elif codec == "BPG":
        codec_id = CODEC_BPG
        qp = int(np.clip(round(pcc), 1, 51))
        pcc = float(qp)
        y_b, y_r = _bpg_encode_plane(y, qp, lossless)
        cb_b, cb_r = _bpg_encode_plane(cb_d, qp, lossless)
        cr_b, cr_r = _bpg_encode_plane(cr_d, qp, lossless)
    else:
        raise ValueError(f"Unsupported research codec: {codec}")

    cb_u, cr_u = _chroma_up(cb_r, cr_r, h, w)
    recon = _from_ycbcr(y_r, cb_u, cr_u, h, w)
    payload = y_b + cb_b + cr_b
    bitstream = _wrap_container(codec_id, w, h, CHROMA_IDS[used_chroma], lossless, pcc, payload)
    info = {
        "codec": codec,
        "pcc": pcc,
        "chroma": used_chroma,
        "lossless": lossless,
        "bitstream_bytes": len(bitstream),
    }
    return bitstream, recon, info


def decode_research_codec(data: bytes) -> np.ndarray:
    meta = _unwrap_container(data)
    buf = meta["payload"]
    offset = 0
    codec_id = meta["codec_id"]
    lossless = meta["lossless"]
    pcc = meta["pcc"]
    h, w = meta["height"], meta["width"]

    if codec_id == CODEC_AGU:
        y, offset = _decode_plane_dct(buf, offset, pcc, 32, lossless)
        cb, offset = _decode_plane_dct(buf, offset, pcc, 32, lossless)
        cr, offset = _decode_plane_dct(buf, offset, pcc, 32, lossless)
        if not lossless:
            y = _deblock(y, 32)
    elif codec_id == CODEC_ADCT:
        y, offset = _adct_decode_plane(buf, offset, pcc, lossless)
        cb, offset = _adct_decode_plane(buf, offset, pcc, lossless)
        cr, offset = _adct_decode_plane(buf, offset, pcc, lossless)
    else:
        qp = int(round(pcc))
        y, offset = _bpg_decode_plane(buf, offset, qp, lossless)
        cb, offset = _bpg_decode_plane(buf, offset, qp, lossless)
        cr, offset = _bpg_decode_plane(buf, offset, qp, lossless)

    cb_u, cr_u = _chroma_up(cb, cr, h, w)
    return _from_ycbcr(y, cb_u, cr_u, h, w)


def preview_png_bytes(rgb: np.ndarray) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG", optimize=True)
    return buf.getvalue()
