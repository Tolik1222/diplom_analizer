import urllib.request
import json
import numpy as np
import cv2

# Create a clean graphic image (text and sharp geometric rectangles, no noise)
img = np.zeros((300, 400, 3), dtype=np.uint8)
img[:] = (245, 240, 240)
cv2.rectangle(img, (50, 50), (350, 250), (20, 30, 200), -1)
cv2.putText(img, 'UI BUTTON', (100, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3)

is_success, buffer = cv2.imencode('.png', img)
raw_bytes = buffer.tobytes()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="graphic.png"\r\n'
    f'Content-Type: image/png\r\n\r\n'
).encode('utf-8') + raw_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/process-all',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    print('=== GRAPHIC PIPELINE RESULT ===')
    print('Content Type:', res['metrics']['metadata']['content_type'])
    print('Noise score:', res['metrics']['noise']['noise_score'])
    print('Recommended format:', res['strategy']['recommended_format'], 'Lossless:', res['strategy']['is_lossless'])
    print('Chroma Subsampling recommended:', res['strategy']['chroma_subsampling'])
    print('SSIM:', res['optimization']['ssim'])
