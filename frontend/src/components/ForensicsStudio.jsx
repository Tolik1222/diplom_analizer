import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://diplom-analizer.onrender.com';

const FORENSIC_MODES = [
  { id: 'original', label: 'Original', tooltip: 'Немодифіковане вихідне зображення' },
  { id: 'ela', label: 'Error Level Analysis', tooltip: 'Аналіз різниці квантування та склейок' },
  { id: 'noise', label: 'Noise Analysis', tooltip: 'Карта високочастотного шуму матриці' },
  { id: 'luminance_gradient', label: 'Luminance Gradient', tooltip: 'Векторний градієнт освітлення (Viridis)' },
  { id: 'level_sweep', label: 'Level Sweep', tooltip: 'Ізолінії квантування динамічного діапазону' },
  { id: 'pca', label: 'Principal Component Analysis', tooltip: 'PCA проекція трьох некорельованих компонент' },
  { id: 'edge_detection', label: 'Edge Detection', tooltip: 'Контурний аналіз Canny' },
  { id: 'equalize', label: 'Histogram Equalize', tooltip: 'Адаптивна еквалізація CLAHE тіней та світла' },
  { id: 'channel_isolation', label: 'Channel Isolation', tooltip: 'Ізоляція каналів (R, G, B, Y, Cb, Cr)' },
  { id: 'bit_plane', label: 'Bit-Plane (LSB)', tooltip: 'Бітові зрізи від LSB (біт 0) до MSB (біт 7)' },
  { id: 'clone_detection', label: 'Clone Detection', tooltip: 'Детекція копіювання / дублювання областей' }
];

export default function ForensicsStudio({ file, originalUrl }) {
  const [activeMode, setActiveMode] = useState('original');
  const [activeChannel, setActiveChannel] = useState('red');
  const [activeBit, setActiveBit] = useState(0);
  const [sweepStep, setSweepStep] = useState(16);
  
  const [cachedImages, setCachedImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [modeInfo, setModeInfo] = useState({
    title: 'Original Image',
    description: 'Вихідне немодифіковане зображення.'
  });

  // Magnifier state
  const [magnifierActive, setMagnifierActive] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(8); // 8x by default
  const [loupeData, setLoupeData] = useState({
    visible: false,
    x: 0,
    y: 0,
    colorHex: '#000000',
    rgb: 'rgb(0, 0, 0)',
    r: 0,
    g: 0,
    b: 0,
    localHist: { r: [], g: [], b: [] }
  });

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const loupeCanvasRef = useRef(null);

  // Cache key generator
  const getCacheKey = useCallback((mode, ch, bit, sweep) => {
    if (mode === 'channel_isolation') return `channel_${ch}`;
    if (mode === 'bit_plane') return `bit_${bit}`;
    if (mode === 'level_sweep') return `sweep_${sweep}`;
    return mode;
  }, []);

  // Fetch or retrieve forensic view
  const loadForensicMode = useCallback(async (mode, extraParam = '') => {
    if (!file) return;
    if (mode === 'original') {
      setModeInfo({
        title: 'Original',
        description: 'Вихідне немодифіковане зображення без обробки.'
      });
      return;
    }

    const key = getCacheKey(mode, activeChannel, activeBit, sweepStep);
    if (cachedImages[key]) {
      setModeInfo(cachedImages[key].info);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('extra_param', String(extraParam));

      const response = await fetch(`${API_BASE}/api/forensics`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Помилка генерації криміналістичного шару');
      const data = await response.json();

      setCachedImages(prev => ({
        ...prev,
        [key]: {
          url: data.data_url,
          info: { title: data.title, description: data.description }
        }
      }));
      setModeInfo({ title: data.title, description: data.description });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [file, activeChannel, activeBit, sweepStep, cachedImages, getCacheKey]);

  // Trigger when mode or sub-parameter changes
  useEffect(() => {
    let extra = '';
    if (activeMode === 'channel_isolation') extra = activeChannel;
    else if (activeMode === 'bit_plane') extra = String(activeBit);
    else if (activeMode === 'level_sweep') extra = String(sweepStep);

    loadForensicMode(activeMode, extra);
  }, [activeMode, activeChannel, activeBit, sweepStep, loadForensicMode]);

  // Current active display image URL
  const currentKey = getCacheKey(activeMode, activeChannel, activeBit, sweepStep);
  const activeImageUrl = activeMode === 'original' ? originalUrl : (cachedImages[currentKey]?.url || originalUrl);

  // Hidden offscreen canvas to sample exact original pixel colors
  useEffect(() => {
    if (!originalUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = originalUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvasRef.current = { canvas, ctx, width: img.naturalWidth, height: img.naturalHeight };
    };
  }, [originalUrl]);

  // Loupe / Magnifier Mouse Move Handler
  const handleMouseMove = (e) => {
    if (!magnifierActive || !imgRef.current || !canvasRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (clientX < 0 || clientY < 0 || clientX > rect.width || clientY > rect.height) {
      setLoupeData(prev => ({ ...prev, visible: false }));
      return;
    }

    const { ctx, width: natW, height: natH } = canvasRef.current;
    const normX = clientX / rect.width;
    const normY = clientY / rect.height;
    const pixelX = Math.min(natW - 1, Math.max(0, Math.floor(normX * natW)));
    const pixelY = Math.min(natH - 1, Math.max(0, Math.floor(normY * natH)));

    // Sample center pixel
    const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    const r = pixelData[0];
    const g = pixelData[1];
    const b = pixelData[2];
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

    // Sample neighborhood for local histogram
    const patchRadius = 10;
    const startX = Math.max(0, pixelX - patchRadius);
    const startY = Math.max(0, pixelY - patchRadius);
    const patchW = Math.min(natW - startX, patchRadius * 2 + 1);
    const patchH = Math.min(natH - startY, patchRadius * 2 + 1);

    const patchData = ctx.getImageData(startX, startY, patchW, patchH).data;
    const histR = new Array(16).fill(0);
    const histG = new Array(16).fill(0);
    const histB = new Array(16).fill(0);

    for (let i = 0; i < patchData.length; i += 4) {
      const bR = Math.min(15, Math.floor(patchData[i] / 16));
      const bG = Math.min(15, Math.floor(patchData[i + 1] / 16));
      const bB = Math.min(15, Math.floor(patchData[i + 2] / 16));
      histR[bR]++;
      histG[bG]++;
      histB[bB]++;
    }

    // Render zoomed patch on loupe canvas
    if (loupeCanvasRef.current) {
      const lCtx = loupeCanvasRef.current.getContext('2d');
      lCtx.imageSmoothingEnabled = false;
      lCtx.clearRect(0, 0, 160, 160);

      const sampleSize = 160 / zoomLevel;
      lCtx.drawImage(
        canvasRef.current.canvas,
        pixelX - sampleSize / 2,
        pixelY - sampleSize / 2,
        sampleSize,
        sampleSize,
        0,
        0,
        160,
        160
      );

      // Center crosshair target
      lCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      lCtx.lineWidth = 1;
      lCtx.strokeRect(74, 74, 12, 12);
    }

    setLoupeData({
      visible: true,
      x: pixelX,
      y: pixelY,
      colorHex: hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      r,
      g,
      b,
      localHist: { r: histR, g: histG, b: histB }
    });
  };

  const handleMouseLeave = () => {
    setLoupeData(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Studio Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Лабораторія глибинного аналізу та криміналістичної діагностики
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            11 аналітичних режимів дослідження артефактів квантування, LSB-стеганографії, копіювання фрагментів та спектральних градієнтів
          </p>
        </div>

        {/* Toggle Magnifier Button */}
        <button
          onClick={() => setMagnifierActive(!magnifierActive)}
          className="chip-btn"
          style={{
            background: magnifierActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            borderColor: magnifierActive ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
            color: magnifierActive ? '#fff' : '#94a3b8'
          }}
        >
          {magnifierActive ? 'Лупа: Активна' : 'Лупа: Вимкнена'}
        </button>
      </div>

      {/* Forensic Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {FORENSIC_MODES.map((m) => {
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className="chip-btn"
              title={m.tooltip}
              style={{
                background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(6, 182, 212, 0.25))' : 'rgba(255, 255, 255, 0.03)',
                borderColor: isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#fff' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap'
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Sub-parameters bar if applicable */}
      {activeMode === 'channel_isolation' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.6rem 1rem', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Канал розкладання:</span>
          {['red', 'green', 'blue', 'luma', 'cb', 'cr'].map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className="chip-btn"
              style={{
                background: activeChannel === ch ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                borderColor: activeChannel === ch ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                color: activeChannel === ch ? '#fff' : '#94a3b8',
                fontSize: '0.75rem'
              }}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {activeMode === 'bit_plane' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.6rem 1rem', borderRadius: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Бітовий зріз (0 - LSB, 7 - MSB):</span>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
            <button
              key={b}
              onClick={() => setActiveBit(b)}
              className="chip-btn"
              style={{
                background: activeBit === b ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                borderColor: activeBit === b ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                color: activeBit === b ? '#fff' : '#94a3b8',
                fontSize: '0.75rem'
              }}
            >
              Біт #{b} {b === 0 ? '(LSB)' : (b === 7 ? '(MSB)' : '')}
            </button>
          ))}
        </div>
      )}

      {activeMode === 'level_sweep' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.6rem 1rem', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Крок квантування: <strong>{sweepStep} рівнів</strong></span>
          <input
            type="range"
            min="4"
            max="64"
            step="4"
            value={sweepStep}
            onChange={(e) => setSweepStep(Number(e.target.value))}
            className="slider-control"
            style={{ maxWidth: '240px' }}
          />
        </div>
      )}

      {/* Main Inspection Canvas Area with Magnifier HUD */}
      <div style={{ position: 'relative', width: '100%', minHeight: '520px', background: '#05070d', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading && (
          <div style={{ position: 'absolute', zIndex: 10, background: 'rgba(9, 13, 22, 0.75)', padding: '1rem 2rem', borderRadius: '12px', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '0.85rem' }}>
            Розрахунок аналітичного шару...
          </div>
        )}

        <img
          ref={imgRef}
          src={activeImageUrl}
          alt="Forensic View"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            maxWidth: '100%',
            maxHeight: '560px',
            objectFit: 'contain',
            cursor: magnifierActive ? 'crosshair' : 'default',
            display: 'block'
          }}
        />

        {/* Magnifier HUD Panel */}
        {magnifierActive && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '280px',
              background: 'rgba(12, 17, 30, 0.92)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '14px',
              padding: '1rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              zIndex: 20,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Header info */}
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.3 }}>
              Hover over the image for a pixel-level loupe with exact RGB/HEX values and a local histogram.
            </div>

            {/* Zoom selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'auto' }}>
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>Zoom</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[2, 4, 8, 16].map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoomLevel(z)}
                    style={{
                      background: zoomLevel === z ? '#6366f1' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    {z}×
                  </button>
                ))}
              </div>
            </div>

            {/* Loupe Window View */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                <canvas ref={loupeCanvasRef} width={160} height={160} style={{ width: '100%', height: '100%' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pixel
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: loupeData.colorHex, border: '1px solid #fff' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {loupeData.colorHex}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    {loupeData.rgb}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Position
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
                    {loupeData.x}, {loupeData.y}
                  </div>
                </div>
              </div>
            </div>

            {/* Local Histogram (RGB) */}
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                Local histogram (RGB)
              </div>
              <div style={{ height: '36px', width: '100%', position: 'relative', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', overflow: 'hidden', padding: '2px' }}>
                <svg viewBox="0 0 160 32" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                  {loupeData.localHist.r.length > 0 && (
                    <>
                      <polyline
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                        points={loupeData.localHist.r.map((val, idx) => `${idx * 10},${30 - Math.min(28, val * 2)}`).join(' ')}
                      />
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                        points={loupeData.localHist.g.map((val, idx) => `${idx * 10},${30 - Math.min(28, val * 2)}`).join(' ')}
                      />
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                        points={loupeData.localHist.b.map((val, idx) => `${idx * 10},${30 - Math.min(28, val * 2)}`).join(' ')}
                      />
                    </>
                  )}
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mode Information Rationale */}
      <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', padding: '0.9rem 1.2rem', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e0e7ff' }}>
            {modeInfo.title}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            {modeInfo.description}
          </div>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          РЕЖИМ: {activeMode.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
