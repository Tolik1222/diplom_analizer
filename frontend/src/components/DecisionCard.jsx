import React, { useState, useEffect } from 'react';

export const CODEC_SPECS = {
  WEBP: {
    label: 'WebP',
    pccName: 'Q',
    pccTitle: 'Параметр якості Q',
    min: 0,
    max: 100,
    step: 1,
    defaultPcc: 84,
    higherIsBetter: true,
    supportsLossless: true,
    supportsChroma: true,
    hint: 'Повний діапазон Q = 0…100. Більше — краща якість (і більший файл). Lossy WebP типово 4:2:0; lossless — 4:4:4.'
  },
  JPEG: {
    label: 'JPEG (Progressive)',
    pccName: 'QF',
    pccTitle: 'Фактор якості QF',
    min: 1,
    max: 100,
    step: 1,
    defaultPcc: 84,
    higherIsBetter: true,
    supportsLossless: false,
    supportsChroma: true,
    hint: 'Повний діапазон QF = 1…100, включно з екстремальними значеннями для дослідження артефактів квантування.'
  },
  PNG: {
    label: 'PNG (без втрат)',
    pccName: 'zlib',
    pccTitle: 'Рівень zlib (0–9)',
    min: 0,
    max: 9,
    step: 1,
    defaultPcc: 9,
    higherIsBetter: false,
    supportsLossless: true,
    supportsChroma: false,
    hint: 'PNG завжди без втрат. Змінюється лише рівень стиснення контейнера, не візуальна якість.'
  },
  BPG: {
    label: 'BPG (HEVC Intra)',
    pccName: 'Q',
    pccTitle: 'Параметр контролю стиснення Q',
    min: 1,
    max: 51,
    step: 1,
    defaultPcc: 32,
    higherIsBetter: false,
    supportsLossless: true,
    supportsChroma: true,
    hint: 'Q ∈ {1…51}, більше Q — сильніше стиснення і гірша якість. Робочий діапазон кафедри зазвичай 25–40, але для дослідження характеристик доступний увесь спектр, включно з Q = 50–51.'
  },
  AGU: {
    label: 'AGU (DCT 32×32)',
    pccName: 'QS',
    pccTitle: 'Крок квантування QS',
    min: 0.5,
    max: 200,
    step: 0.5,
    defaultPcc: 9,
    higherIsBetter: false,
    supportsLossless: true,
    supportsChroma: true,
    hint: 'QS > 0 (зазвичай до 100, для дослідження — до 200). Менший QS — вища якість. Типові малопомітні спотворення: QS ≈ 8–12.'
  },
  ADCT: {
    label: 'ADCT (partition DCT)',
    pccName: 'QS',
    pccTitle: 'Крок квантування QS',
    min: 0.5,
    max: 200,
    step: 0.5,
    defaultPcc: 9,
    higherIsBetter: false,
    supportsLossless: true,
    supportsChroma: true,
    hint: 'Той самий PCC, що в ADCTC: крок квантування QS. Більший QS — більший коефіцієнт стиснення. Доступні екстремальні значення для побудови R-D кривих.'
  }
};

export default function DecisionCard({ strategy, onReoptimize, isProcessing, onOpenGuide }) {
  const [isManual, setIsManual] = useState(false);
  const [showMatrix, setShowMatrix] = useState(true);
  const [customFormat, setCustomFormat] = useState('WEBP');
  const [customQuality, setCustomQuality] = useState(84);
  const [customFilter, setCustomFilter] = useState('none');
  const [customLossless, setCustomLossless] = useState(false);
  const [customChroma, setCustomChroma] = useState('4:2:0');

  useEffect(() => {
    if (strategy) {
      setCustomFormat(strategy.recommended_format || 'WEBP');
      setCustomQuality(strategy.recommended_quality ?? 84);
      setCustomFilter(strategy.denoise_filter || 'none');
      setCustomLossless(Boolean(strategy.is_lossless));
      const chroma = String(strategy.chroma_subsampling || '4:2:0');
      if (chroma.includes('4:4:4')) setCustomChroma('4:4:4');
      else if (chroma.includes('4:2:2')) setCustomChroma('4:2:2');
      else setCustomChroma('4:2:0');
    }
  }, [strategy]);

  if (!strategy) return null;

  const spec = CODEC_SPECS[customFormat] || CODEC_SPECS.WEBP;
  const pccDisabled = customLossless && spec.supportsLossless && customFormat !== 'PNG';

  const handleFormatChange = (fmt) => {
    const next = CODEC_SPECS[fmt] || CODEC_SPECS.WEBP;
    setCustomFormat(fmt);
    setCustomQuality(next.defaultPcc);
    if (!next.supportsLossless) setCustomLossless(false);
    if (fmt === 'PNG') {
      setCustomLossless(true);
      setCustomChroma('4:4:4');
    }
  };

  const handleApplyCustom = () => {
    const nextSpec = CODEC_SPECS[customFormat] || CODEC_SPECS.WEBP;
    const lossless = nextSpec.supportsLossless ? (customFormat === 'PNG' ? true : customLossless) : false;
    const chroma = nextSpec.supportsChroma ? customChroma : '4:4:4';
    const updatedStrategy = {
      ...strategy,
      recommended_format: customFormat,
      recommended_quality: Number(customQuality),
      denoise_filter: customFilter,
      is_lossless: lossless,
      chroma_subsampling: chroma,
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
  const recSpec = CODEC_SPECS[recFormat] || CODEC_SPECS.WEBP;
  const decisionMatrix = strategy.decision_matrix || [];

  return (
    <div className="strategy-banner glass-panel">
      <div className="strategy-title-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
              Модуль автоматичного синтезу рішень (Adaptive Decision Engine)
            </h3>
            <span className="strategy-tag" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)', padding: '0.15rem 0.5rem' }}>
              Числове обґрунтування
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Автоматичний розрахунок параметрів кодування на базі порогових значень ентропії, SI та шуму
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="chip-btn"
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                borderColor: 'rgba(6, 182, 212, 0.4)',
                color: '#67e8f9'
              }}
            >
              Довідник порогів
            </button>
          )}

          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="chip-btn"
            style={{
              background: showMatrix ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              borderColor: showMatrix ? '#6366f1' : 'rgba(255,255,255,0.1)',
              color: showMatrix ? '#fff' : '#94a3b8'
            }}
          >
            {showMatrix ? 'Приховати матрицю' : 'Матриця критеріїв'}
          </button>

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

      {/* Target specs chips */}
      <div className="strategy-tags">
        <span className="strategy-tag">
          Кодек: {recFormat} {isLossless ? '(Lossless)' : `${recSpec.pccName}=${recQuality}`}
        </span>
        <span className="strategy-tag">
          Субдискретизація: {chroma}
        </span>
        <span className="strategy-tag">
          Фільтрація: {denoise === 'none' ? 'Вимкнено (1:1 деталі)' : denoise}
        </span>
        <span className="strategy-tag">
          Простір кольору: sRGB
        </span>
      </div>

      {/* Scientific Summary Callout */}
      {strategy.scientific_summary && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          borderLeft: '4px solid #6366f1',
          padding: '0.75rem 1rem',
          borderRadius: '4px 8px 8px 4px',
          fontSize: '0.82rem',
          color: '#e2e8f0',
          lineHeight: '1.5'
        }}>
          <strong style={{ color: '#a5b4fc' }}>Науковий синтез рішення: </strong>
          {strategy.scientific_summary}
        </div>
      )}

      {/* Detailed Decision Matrix Table */}
      {showMatrix && decisionMatrix.length > 0 && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: '10px',
          padding: '0.85rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Матриця порогових критеріїв автоматичного рішення
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Оцінено {decisionMatrix.length} критеріїв
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '0.5rem 0.6rem' }}>Параметр</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Виміряне значення</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Пороговий критерій</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Класифікація контенту</th>
                <th style={{ padding: '0.5rem 0.6rem' }}>Прийняте рішення</th>
              </tr>
            </thead>
            <tbody>
              {decisionMatrix.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '0.55rem 0.6rem', color: '#f1f5f9', fontWeight: 600 }}>
                    {item.name}
                    {item.formula && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                        {item.formula}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 700 }}>
                    {item.measured_value}
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem', color: '#cbd5e1' }}>
                    {item.threshold}
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem' }}>
                    <span style={{
                      padding: '0.2rem 0.45rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      background: item.metric_id === 'noise_score' && item.numerical_value > 20
                        ? 'rgba(244, 63, 94, 0.15)'
                        : 'rgba(99, 102, 241, 0.15)',
                      color: item.metric_id === 'noise_score' && item.numerical_value > 20 ? '#fb7185' : '#a5b4fc',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      {item.classification}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.6rem', color: '#94a3b8', lineHeight: '1.4' }}>
                    {item.decision_impact}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Explanations List */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        borderRadius: '10px',
        padding: '0.85rem 1rem',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          <strong style={{ color: '#a5b4fc' }}>Обґрунтування кодування: </strong>
          {strategy.explanations?.format || 'Оптимальне квантування обрано на основі складності.'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          <strong style={{ color: '#a5b4fc' }}>Обґрунтування фільтрації шуму: </strong>
          {strategy.explanations?.filter || 'Оцінка шуму завершена.'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
          <strong style={{ color: '#a5b4fc' }}>Колірна нормалізація: </strong>
          {strategy.explanations?.color || 'Нормалізація кольору для веб-стандарту.'}
        </div>
      </div>

      {/* Manual PCC panel */}
      {isManual && (
        <div className="manual-codec-panel">
          <div className="manual-codec-grid">
            <div>
              <label className="manual-label">Кодек / формат</label>
              <select
                value={customFormat}
                onChange={(e) => handleFormatChange(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="WEBP">WebP</option>
                <option value="JPEG">JPEG (Progressive)</option>
                <option value="PNG">PNG (Lossless)</option>
                <option value="BPG">BPG (кафедральний, Q=1…51)</option>
                <option value="AGU">AGU (DCT 32×32, QS)</option>
                <option value="ADCT">ADCT (partition DCT, QS)</option>
              </select>
            </div>

            <div>
              <label className="manual-label">Колірна субдискретизація</label>
              <select
                value={customChroma}
                onChange={(e) => setCustomChroma(e.target.value)}
                disabled={!spec.supportsChroma || customLossless}
                style={{ width: '100%', opacity: !spec.supportsChroma || customLossless ? 0.5 : 1 }}
              >
                <option value="4:4:4">4:4:4 (повна хроматична роздільність)</option>
                <option value="4:2:2">4:2:2 (горизонтальна ½)</option>
                <option value="4:2:0">4:2:0 (типова для фото)</option>
              </select>
            </div>

            <div>
              <label className="manual-label">Режим кодування</label>
              <select
                value={customLossless || customFormat === 'PNG' ? 'lossless' : 'lossy'}
                onChange={(e) => setCustomLossless(e.target.value === 'lossless')}
                disabled={!spec.supportsLossless || customFormat === 'PNG'}
                style={{ width: '100%', opacity: !spec.supportsLossless ? 0.5 : 1 }}
              >
                <option value="lossy">З втратами (lossy)</option>
                <option value="lossless">Без втрат (lossless)</option>
              </select>
              {!spec.supportsLossless && (
                <div className="manual-microhint">JPEG не має true-lossless у цьому пайплайні</div>
              )}
            </div>

            <div>
              <label className="manual-label">Префільтрація шуму</label>
              <select
                value={customFilter}
                onChange={(e) => setCustomFilter(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="none">Вимкнено (оригінальні пікселі)</option>
                <option value="bilateral_mild">Легка білатеральна (d=5)</option>
                <option value="bilateral_strong">Потужна білатеральна (d=7)</option>
              </select>
            </div>
          </div>

          <div className="manual-pcc-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <span className="manual-label" style={{ marginBottom: 0 }}>
                  {spec.pccTitle} ({spec.pccName})
                  {spec.higherIsBetter ? ' — більше = краща якість' : ' — більше = сильніше стиснення'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number"
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={customQuality}
                    disabled={pccDisabled}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isNaN(v)) return;
                      setCustomQuality(Math.min(spec.max, Math.max(spec.min, v)));
                    }}
                    style={{ width: '88px', padding: '0.35rem 0.5rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={customQuality}
                disabled={pccDisabled}
                onChange={(e) => setCustomQuality(Number(e.target.value))}
                className="slider-control"
                style={{ opacity: pccDisabled ? 0.35 : 1 }}
              />
              <p className="manual-hint">{spec.hint}</p>
            </div>

            <button
              onClick={handleApplyCustom}
              disabled={isProcessing}
              className="btn-primary"
              style={{ minWidth: '220px', height: '48px', alignSelf: 'center' }}
            >
              {isProcessing ? 'Обробка...' : 'Застосувати параметри'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
