import React, { useState, useEffect } from 'react';

export default function HistoryDrawer({
  isOpen,
  onClose,
  apiBase,
  authToken,
  onSelectHistoryItem,
  onHistoryCountChange
}) {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch(`${apiBase}/api/history?limit=25`, { headers });
      if (!response.ok) {
        throw new Error('Не вдалося отримати історію аналізу.');
      }
      const data = await response.json();
      if (data && data.history) {
        setHistoryItems(data.history);
        if (onHistoryCountChange) {
          onHistoryCountChange(data.history.length);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, authToken]);

  const handleDeleteItem = async (e, id) => {
    e.stopPropagation();
    try {
      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch(`${apiBase}/api/history/${id}`, {
        method: 'DELETE',
        headers
      });
      if (response.ok) {
        const next = historyItems.filter((item) => item.id !== id);
        setHistoryItems(next);
        if (onHistoryCountChange) {
          onHistoryCountChange(next.length);
        }
      }
    } catch (err) {
      console.error('Delete history error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Ви впевнені, що хочете очистити всю історію аналізу?')) return;
    try {
      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch(`${apiBase}/api/history`, {
        method: 'DELETE',
        headers
      });
      if (response.ok) {
        setHistoryItems([]);
        if (onHistoryCountChange) {
          onHistoryCountChange(0);
        }
      }
    } catch (err) {
      console.error('Clear history error:', err);
    }
  };

  const handleLoadItem = async (id) => {
    try {
      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch(`${apiBase}/api/history/${id}`, { headers });
      if (!response.ok) {
        throw new Error('Не вдалося завантажити деталі запису.');
      }
      const data = await response.json();
      if (data && data.item) {
        onSelectHistoryItem(data.item);
        onClose();
      }
    } catch (err) {
      alert(`Помилка завантаження: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Історія аналізів та завантажених зображень
              </h3>
              <span className="strategy-tag" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                {historyItems.length} записів
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Збережені в базі даних SQLite результати оцінки, спектральні характеристики та оптимізовані файли
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Закрити">
            ✕
          </button>
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 1.5rem',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Натисніть «Завантажити в студію» для відновлення зображення, форензики та слайдера
          </span>
          {historyItems.length > 0 && (
            <button
              onClick={handleClearAll}
              className="chip-btn"
              style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Очистити всю історію
            </button>
          )}
        </div>

        {/* Content list */}
        <div className="modal-body" style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Завантаження збережених записів...
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fb7185',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '0.82rem'
            }}>
              {error}
            </div>
          )}

          {!loading && historyItems.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#64748b',
              fontSize: '0.88rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px dashed var(--border-subtle)'
            }}>
              <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
                Історія порожня
              </div>
              Завантажте зображення у робочу область. Кожен проведений аналіз та результат компресії
              автоматично записується в базу даних.
            </div>
          )}

          {!loading && historyItems.map((item) => {
            const origKb = item.original_size_bytes ? (item.original_size_bytes / 1024).toFixed(1) : '0';
            const optKb = item.optimized_size_bytes ? (item.optimized_size_bytes / 1024).toFixed(1) : '0';
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('uk-UA') : '';

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'border-color 0.2s',
                  flexWrap: 'wrap'
                }}
              >
                {/* Thumbnail and Filename */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.filename}
                      style={{
                        width: '48px',
                        height: '48px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: '#000'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a5b4fc',
                      fontSize: '0.7rem'
                    }}>
                      IMG
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                      {item.filename}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      {dateStr}
                    </div>
                  </div>
                </div>

                {/* Metrics chips */}
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                    <span style={{ color: '#94a3b8' }}>{origKb} KB</span>
                    <span style={{ color: '#64748b', margin: '0 4px' }}>→</span>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>{optKb} KB</span>
                  </div>

                  <span style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#6ee7b7',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}>
                    -{item.saved_percent}%
                  </span>

                  <span style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#c7d2fe',
                    fontSize: '0.72rem'
                  }}>
                    {item.format} (Q={item.quality})
                  </span>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#94a3b8' }}>
                    SSIM: <strong style={{ color: '#a5b4fc' }}>{item.ssim}</strong>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#64748b' }}>
                    H={item.entropy_bits} | SI={item.spatial_info}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <button
                    onClick={() => handleLoadItem(item.id)}
                    className="btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.76rem', height: '32px' }}
                  >
                    Завантажити в студію
                  </button>
                  <button
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="chip-btn"
                    title="Видалити запис"
                    style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)', padding: '0.35rem 0.5rem', height: '32px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Історія зберігається локально в SQLite базі даних `optimetrics.db`
          </span>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
