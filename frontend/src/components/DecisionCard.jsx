import React, { useState, useEffect } from 'react';

export default function DecisionCard({ strategy, onReoptimize, isProcessing }) {
  const [isManual, setIsManual] = useState(false);
  const [customFormat, setCustomFormat] = useState('WEBP');
  const [customQuality, setCustomQuality] = useState(84);
  const [customFilter, setCustomFilter] = useState('none');
  const [customLossless, setCustomLossless] = useState(false);

  // Sync internal state when strategy changes upon new image upload
  useEffect(() => {
    if (strategy) {
      setCustomFormat(strategy.recommended_format || 'WEBP');
      setCustomQuality(strategy.recommended_quality ?? 84);
      setCustomFilter(strategy.denoise_filter || 'none');
      setCustomLossless(strategy.is_lossless || false);
    }
  }, [strategy]);

  if (!strategy) return null;

  const handleApplyCustom = () => {
    const updatedStrategy = {
      ...strategy,
      recommended_format: customFormat,
      recommended_quality: Number(customQuality),
      denoise_filter: customFilter,
      is_lossless: customLossless,
      filter_params: customFilter === 'bilateral_strong' 
        ? { diameter: 7, sigmaColor: 40, sigmaSpace: 40 }
        : customFilter === 'bilateral_mild' 
        ? { diameter: 5, sigmaColor: 22, sigmaSpace: 22 }
        : {}
    };
    onReoptimize(updatedStrategy);
  };

  const recFormat = strategy.recommended_format || 'WEBP';
  const recQuality = strategy.recommended_quality ?? 84;
  const isLossless = strategy.is_lossless || false;
  const chroma = strategy.chroma_subsampling || '4:2:0';
  const denoise = strategy.denoise_filter || 'none';

  return (
    <div className="strategy-banner glass-panel">
      <div className="strategy-title-row">
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
            Модуль автоматичного синтезу рішень (Adaptive Decision Engine)
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Автоматичний розрахунок параметрів кодування на основі аналізу шуму та просторової складності
          </p>
        </div>

        {/* Toggle Auto / Manual mode */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setIsManual(!isManual)}
            className="chip-btn"
            style={{
              background: isManual ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              borderColor: isManual ? '#6366f1' : 'rgba(255,255,255,0.1)',
              color: isManual ? '#fff' : '#94a3b8'
            }}
          >
            {isManual ? 'Режим: Ручний вибір' : 'Режим: Автоматичний'}
          </button>
        </div>
      </div>

      {/* Rationale badges */}
      <div className="strategy-tags">
        <span className="strategy-tag">
          Формат: {recFormat} {isLossless ? '(Lossless)' : `Q=${recQuality}`}
        </span>
        <span className="strategy-tag">
          Субдискретизація: {chroma}
        </span>
        <span className="strategy-tag">
          Фільтрація: {denoise === 'none' ? 'Вимкнено' : denoise}
        </span>
        <span className="strategy-tag">
          Простір кольору: sRGB
        </span>
      </div>

      {/* Explanations */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '10px',
        padding: '1rem',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem'
      }}>
        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
          <strong style={{ color: '#a5b4fc' }}>Обґрунтування кодування: </strong> 
          {strategy.explanations?.format || 'Оптимальне квантування обрано на основі складності.'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
          <strong style={{ color: '#a5b4fc' }}>Обґрунтування фільтрації шуму: </strong> 
          {strategy.explanations?.filter || 'Оцінка шуму завершена.'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
          <strong style={{ color: '#a5b4fc' }}>Колірна нормалізація: </strong> 
          {strategy.explanations?.color || 'Нормалізація кольору для веб-стандарту.'}
        </div>
      </div>

      {/* Manual Override Controls */}
      {isManual && (
        <div style={{
          marginTop: '0.75rem',
          padding: '1.25rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Цільовий формат:
            </label>
            <select
              value={customFormat}
              onChange={(e) => setCustomFormat(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="WEBP">WebP (Сучасний веб-стандарт)</option>
              <option value="JPEG">JPEG (Progressive)</option>
              <option value="PNG">PNG (Lossless)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              <span>Параметр якості Q:</span>
              <strong style={{ color: '#fff' }}>{customQuality}</strong>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={customQuality}
              onChange={(e) => setCustomQuality(Number(e.target.value))}
              className="slider-control"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
              Префільтрація шуму:
            </label>
            <select
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="none">Вимкнено (Оригінальні пікселі)</option>
              <option value="bilateral_mild">Легка білатеральна (d=5)</option>
              <option value="bilateral_strong">Потужна білатеральна (d=7)</option>
            </select>
          </div>

          <div>
            <button
              onClick={handleApplyCustom}
              disabled={isProcessing}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              {isProcessing ? 'Обробка...' : 'Застосувати параметри'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
