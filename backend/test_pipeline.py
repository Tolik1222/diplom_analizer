import urllib.request
import json
import numpy as np
import cv2

# Create a test image
img = np.zeros((300, 400, 3), dtype=np.uint8)
img[:] = (40, 100, 200)
cv2.putText(img, 'Diploma Test', (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
# Add some noise
noise = np.random.normal(0, 15, img.shape).astype(np.int16)
img_noisy = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

is_success, buffer = cv2.imencode('.jpg', img_noisy)
raw_bytes = buffer.tobytes()

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode('utf-8') + raw_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/process-all',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    print('=== END-TO-END PIPELINE RESULT ===')
    print('SUCCESS:', res.get('success'))
    print('Noise score:', res['metrics']['noise']['noise_score'], '| Level:', res['metrics']['noise']['noise_level'])
    print('Entropy:', res['metrics']['complexity']['entropy_bits'], 'bits/px')
    print('Spatial Info (SI):', res['metrics']['complexity']['spatial_information'])
    print('Sharpness score:', res['metrics']['sharpness']['sharpness_score'])
    print('Chroma Subsampling detected:', res['metrics']['color']['chroma_subsampling'])
    print('Recommended strategy:', res['strategy']['recommended_format'], 'Q=', res['strategy']['recommended_quality'])
    print('Denoise filter recommended:', res['strategy']['denoise_filter'])
    print('Original size:', res['optimization']['original_size_kb'], 'KB -> Optimized size:', res['optimization']['optimized_size_kb'], 'KB')
    print('Savings:', res['optimization']['saved_percent'], '%')
    print('SSIM:', res['optimization']['ssim'], '| PSNR:', res['optimization']['psnr_db'], 'dB')
