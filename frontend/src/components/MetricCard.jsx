import React from 'react';

export default function MetricCard({ title, badge, badgeType, value, unit, description, formula, progress, progressColor }) {
  const getBadgeClass = (type) => {
    switch (type) {
      case 'clean': return 'badge-clean';
      case 'warning': return 'badge-warning';
      case 'alert': return 'badge-alert';
      default: return 'badge-info';
    }
  };

  return (
    <div className="glass-panel metric-card">
      <div className="metric-card-header">
        <div className="metric-icon-title">
          <span>{title}</span>
        </div>
        {badge && (
          <span className={`metric-badge ${getBadgeClass(badgeType)}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="metric-value-large">
        {value} {unit && <span>{unit}</span>}
      </div>

      {progress !== undefined && (
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, Math.max(0, Number(progress) || 0))}%`,
              background: progressColor || 'linear-gradient(90deg, #6366f1, #06b6d4)'
            }}
          />
        </div>
      )}

      <div>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
          {description}
        </p>
        {formula && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            Алгоритм: {formula}
          </div>
        )}
      </div>
    </div>
  );
}
