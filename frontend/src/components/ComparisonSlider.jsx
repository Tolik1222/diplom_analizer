import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function ComparisonSlider({ originalUrl, optimizedUrl, meta, optimization }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.clientWidth || 800);

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 800);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.min(Math.max((x / rect.width) * 100, 2), 98);
    setSliderPosition(percent);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleClick = (e) => {
    handleMove(e.clientX);
  };

  const downloadOptimized = () => {
    if (!optimization || !optimization.data_url) return;
    const a = document.createElement('a');
    a.href = optimization.data_url;
    const origBase = meta?.filename
      ? meta.filename.substring(0, meta.filename.lastIndexOf('.')) || meta.filename
      : 'image';
    a.download = `${origBase}_optimized.${optimization.extension || 'webp'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const savedPercent = optimization?.saved_percent !== undefined ? optimization.saved_percent : 0;
  const ssimVal = optimization?.ssim !== undefined ? optimization.ssim : 1.0;
  const psnrVal = optimization?.psnr_db !== undefined ? optimization.psnr_db : 0;

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Візуальне порівняння «Оригінал / Оптимізовано»
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Перетягування розділювача для покадрової інспекції пікселів та артефактів квантування
          </p>
        </div>

        {optimization?.data_url && (
          <button onClick={downloadOptimized} className="btn-primary" id="download-btn">
            Експорт оптимізованого файлу ({optimization.optimized_size_kb ?? 0} KB)
          </button>
        )}
      </div>

      {/* Split Slider Container */}
      <div
        ref={containerRef}
        className="split-slider-box"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
        onClick={handleClick}
        style={{ cursor: isDragging ? 'ew-resize' : 'default' }}
      >
        {/* Background Layer: Optimized Image */}
        <img
          src={optimizedUrl || originalUrl}
          alt="Optimized"
          className="split-img"
        />

        {/* Foreground Layer (Clipped): Original Image */}
        <div
          className="split-overlay"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={originalUrl}
            alt="Original"
            className="split-img"
            style={{
              width: `${containerWidth}px`,
              maxWidth: 'none'
            }}
          />
        </div>

        {/* Draggable Divider Handle */}
        <div
          className="slider-handle"
          style={{ left: `${sliderPosition}%`, fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}
          onMouseDown={handleMouseDown}
        >
          ||
        </div>

        {/* Badges */}
        <div className="split-label label-original">
          Оригінал: {meta?.format || 'RAW'} ({meta?.file_size_kb ?? 0} KB)
        </div>

        <div className="split-label label-optimized">
          Оптимізовано: {optimization?.format || 'WEBP'} ({optimization?.optimized_size_kb ?? 0} KB)
        </div>
      </div>

      {/* Bottom Result Metrics Bar */}
      {optimization && (
        <div className="summary-bar">
          <div className="glass-panel summary-stat" style={{ borderLeft: '3px solid #10b981' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Економія трафіку
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
              -{savedPercent}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              з {meta?.file_size_kb ?? 0} KB до {optimization.optimized_size_kb ?? 0} KB
            </div>
          </div>

          <div className="glass-panel summary-stat" style={{ borderLeft: '3px solid #6366f1' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Метрика SSIM
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
              {ssimVal}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {ssimVal > 0.95 ? 'Висока структурна схожість' : 'Задовільна якість'}
            </div>
          </div>

          <div className="glass-panel summary-stat" style={{ borderLeft: '3px solid #06b6d4' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Метрика PSNR
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {psnrVal} <span style={{ fontSize: '0.9rem' }}>dB</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Співвідношення сигнал/шум
            </div>
          </div>

          <div className="glass-panel summary-stat" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Формат і якість
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
              {optimization.format || 'WEBP'} <span style={{ fontSize: '0.9rem' }}>Q={optimization.quality_applied ?? 84}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {optimization.applied_filter && optimization.applied_filter !== 'none'
                ? 'Білатеральна фільтрація'
                : 'Без попередньої фільтрації'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
