import io
from PIL import Image
from app.analyzer.forensics import generate_forensic_mode

img = Image.new('RGB', (200, 200), (120, 80, 200))
buf = io.BytesIO()
img.save(buf, format='JPEG')
raw = buf.getvalue()

modes = [
    'original', 'ela', 'noise', 'luminance_gradient', 'level_sweep',
    'pca', 'edge_detection', 'equalize', 'channel_isolation', 'bit_plane', 'clone_detection'
]

for m in modes:
    res = generate_forensic_mode(raw, m)
    print(f"Mode: {m:20} -> {res['title'][:35]} | URL length: {len(res['data_url'])}")

print("ALL FORENSICS MODES PASSED!")
