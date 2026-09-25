import React, { useState } from 'react';

export default function HistogramChart({ histograms }) {
  const [activeChannel, setActiveChannel] = useState('all');

  if (!histograms || !Array.isArray(histograms.r) || histograms.r.length === 0) {
    return null;
  }

  const rData = Array.isArray(histograms.r) ? histograms.r : [];
  const gData = Array.isArray(histograms.g) ? histograms.g : [];
  const bData = Array.isArray(histograms.b) ? histograms.b : [];
  const lumData = Array.isArray(histograms.luminance) ? histograms.luminance : [];

  // Compute maximum safely without spreading potentially large arrays
  let maxVal = 1.0;
  const allValues = [rData, gData, bData, lumData];
  for (const arr of allValues) {
    for (const val of arr) {
      if (typeof val === 'number' && !isNaN(val) && val > maxVal) {
        maxVal = val;
      }
    }
  }

  const getPoints = (data) => {
    if (!Array.isArray(data) || data.length === 0) return '';
    const len = data.length;
    return data
      .map((val, idx) => {
        const num = typeof val === 'number' && !isNaN(val) ? val : 0;
        const x = (idx / Math.max(1, len - 1)) * 300;
        const y = Math.max(5, Math.min(80, 80 - (num / maxVal) * 70));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            Спектральний розподіл яскравості та каналів (Гістограма)
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Розподіл інтенсивності пікселів за 48 динамічними бінами (0 – 255)
          </p>
        </div>
        
        {/* Channel Filters */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { id: 'all', label: 'Всі' },
            { id: 'lum', label: 'Яскравість (Y)', color: '#e2e8f0' },
            { id: 'r', label: 'Red', color: '#f43f5e' },
            { id: 'g', label: 'Green', color: '#10b981' },
            { id: 'b', label: 'Blue', color: '#38bdf8' }
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: activeChannel === ch.id ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                background: activeChannel === ch.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                color: ch.color || (activeChannel === ch.id ? '#fff' : '#94a3b8'),
                cursor: 'pointer'
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '110px', position: 'relative' }}>
        <svg viewBox="0 0 300 85" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          {/* Subtle grid lines */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.1)" />

          {/* Red channel */}
          {(activeChannel === 'all' || activeChannel === 'r') && rData.length > 0 && (
            <polyline
              fill="none"
              stroke="#f43f5e"
              strokeWidth={activeChannel === 'r' ? '2.5' : '1.5'}
              strokeOpacity={activeChannel === 'r' ? '1' : '0.6'}
              points={getPoints(rData)}
            />
          )}

          {/* Green channel */}
          {(activeChannel === 'all' || activeChannel === 'g') && gData.length > 0 && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth={activeChannel === 'g' ? '2.5' : '1.5'}
              strokeOpacity={activeChannel === 'g' ? '1' : '0.6'}
              points={getPoints(gData)}
            />
          )}

          {/* Blue channel */}
          {(activeChannel === 'all' || activeChannel === 'b') && bData.length > 0 && (
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth={activeChannel === 'b' ? '2.5' : '1.5'}
              strokeOpacity={activeChannel === 'b' ? '1' : '0.6'}
              points={getPoints(bData)}
            />
          )}

          {/* Luminance channel */}
          {(activeChannel === 'all' || activeChannel === 'lum') && lumData.length > 0 && (
            <polyline
              fill="none"
              stroke="#ffffff"
              strokeWidth={activeChannel === 'lum' ? '2.5' : '1.2'}
              strokeOpacity={activeChannel === 'lum' ? '1' : '0.5'}
              strokeDasharray={activeChannel === 'all' ? '2 2' : 'none'}
              points={getPoints(lumData)}
            />
          )}
        </svg>

        {/* Axis indicators */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
          <span>Тіні (0)</span>
          <span>Середні тони (128)</span>
          <span>Світла (255)</span>
        </div>
      </div>
    </div>
  );
}
