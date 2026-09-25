// Utility to generate synthetic test images with known characteristics
// directly in the browser to demonstrate the diploma project without external assets.

export function createSampleImage(type = 'photo') {
  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 500;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (type === 'graphic') {
    // 1. UI / Vector / Diagram Graphic (High sharpness, zero noise, flat colors, text)
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Flat UI Cards & Vector shapes
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(60, 60, 320, 200, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Vector / UI Graphics Sample', 85, 110);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('High contrast edges & text elements', 85, 145);
    ctx.fillText('Optimal for 4:4:4 lossless encoding', 85, 175);

    // Accent vibrant shapes
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(580, 160, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(440, 260, 280, 160, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('OptiMetrics 4:4:4 Test', 465, 345);

  } else if (type === 'noisy') {
    // 2. High Noise Photographic Scene
    // Base gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1a103c');
    grad.addColorStop(0.5, '#432371');
    grad.addColorStop(1, '#faae7b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Complex organic circles/textures
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsla(${i * 15}, 70%, 60%, 0.3)`;
      ctx.beginPath();
      ctx.arc(
        (i * 97) % width,
        (i * 73) % height,
        30 + (i % 5) * 15,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Inject heavy Gaussian-like noise
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 75; // Heavy noise
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

  } else {
    // 3. Detailed Landscape / Photographic Sample
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0c4a6e');
    grad.addColorStop(0.4, '#0284c7');
    grad.addColorStop(0.7, '#f59e0b');
    grad.addColorStop(1, '#dc2626');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Mountains (fine high-frequency textures)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 15) {
      const y = height - 160 - Math.sin(x * 0.015) * 80 - Math.cos(x * 0.04) * 35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Secondary foreground ridge
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 10) {
      const y = height - 70 - Math.sin(x * 0.03) * 40 - Math.cos(x * 0.08) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Sun
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(width * 0.75, 140, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob], `sample_${type}.jpg`, { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg', 0.95);
  });
}
