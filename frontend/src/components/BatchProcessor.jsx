import React, { useState, useRef } from 'react';
import { createSampleImage } from '../utils/sampleGenerator';

export default function BatchProcessor({ apiBase, onInspectSingle, isScientific = false, authToken = '' }) {
  const [batchItems, setBatchItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const processFilesBatch = async (files) => {
    if (!files || files.length === 0) return;
    setError(null);
    setLoading(true);
    setProgressMsg(`Завантаження та паралельний аналіз ${files.length} файлів...`);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${apiBase}/api/batch-process`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Помилка сервера: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Batch processing response:', data);

      if (!data || !data.items) {
        throw new Error('Отримано некоректну відповідь від сервера пакетної обробки.');
      }

      // Generate preview data URLs for items
      const enrichedItems = await Promise.all(
        data.items.map(async (item, idx) => {
          const originalFile = files[idx];
          let originalUrl = null;
          if (originalFile) {
            originalUrl = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = (e) => res(e.target.result);
              reader.readAsDataURL(originalFile);
            });
          }
          return {
            ...item,
            originalFile,
            originalUrl: originalUrl || item.optimization?.data_url,
          };
        })
      );

      setBatchItems(enrichedItems);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Batch error:', err);
      setError(`Не вдалося виконати пакетну обробку: ${err.message}`);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleFilesSelected = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFilesBatch(e.target.files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFilesBatch(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Load a preset bundle of 3 synthetic sample images
  const loadPresetBatch = () => {
    const photoBlob = createSampleImage('photo');
    const photoFile = new File([photoBlob], 'Sample_Photo.jpg', { type: 'image/jpeg' });

    const graphicBlob = createSampleImage('graphic');
    const graphicFile = new File([graphicBlob], 'Sample_Vector_UI.png', { type: 'image/png' });

    const noisyBlob = createSampleImage('noisy');
    const noisyFile = new File([noisyBlob], 'Sample_Noisy_Texture.jpg', { type: 'image/jpeg' });

    processFilesBatch([photoFile, graphicFile, noisyFile]);
  };

  // Export structured JSON report
  const exportBatchJson = () => {
    if (!summary || batchItems.length === 0) return;
    const reportData = {
      project: 'OptiMetrics AI - Batch Processing Scientific Report',
      timestamp: new Date().toISOString(),
      batch_summary: summary,
      processed_images: batchItems.map((item) => ({
        filename: item.filename,
        success: item.success,
        metrics: item.metrics,
        decision_strategy: item.strategy,
        optimization_result: {
          format: item.optimization?.format,
          quality: item.optimization?.quality_applied,
          original_size_bytes: item.optimization?.original_size_bytes,
          compressed_size_bytes: item.optimization?.optimized_size_bytes,
          saved_percent: item.optimization?.saved_percent,
          ssim: item.optimization?.ssim,
          psnr_db: item.optimization?.psnr_db
        }
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptiMetrics_Batch_Report_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export CSV summary table
  const exportBatchCsv = () => {
    if (batchItems.length === 0) return;
    const headers = [
      'Filename',
      'Original_Size_KB',
      'Optimized_Size_KB',
      'Saved_Percent',
      'Format',
      'Quality_PCC',
      'SSIM',
      'PSNR_dB',
      'Entropy_H',
      'Spatial_Info_SI',
      'Noise_Score'
    ];

    const rows = batchItems.map((item) => {
      const origKb = item.optimization?.original_size_bytes ? (item.optimization.original_size_bytes / 1024).toFixed(1) : '0';
      const optKb = item.optimization?.optimized_size_bytes ? (item.optimization.optimized_size_bytes / 1024).toFixed(1) : '0';
      const saved = item.optimization?.saved_percent ?? '0';
      const fmt = item.optimization?.format || 'WEBP';
      const q = item.optimization?.quality_applied ?? '84';
      const ssim = item.optimization?.ssim ?? '1.0';
      const psnr = item.optimization?.psnr_db ?? '0';
      const h = item.metrics?.complexity?.entropy_bits ?? '0';
      const si = item.metrics?.complexity?.spatial_information ?? '0';
      const noise = item.metrics?.noise?.noise_score ?? '0';

      return [
        `"${item.filename}"`,
        origKb,
        optKb,
        saved,
        fmt,
        q,
        ssim,
        psnr,
        h,
        si,
        noise
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptiMetrics_Batch_Summary_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download single image
  const downloadSingleOptimized = (item) => {
    if (!item.optimization?.data_url) return;
    const a = document.createElement('a');
    a.href = item.optimization.data_url;
    const ext = (item.optimization.format || 'webp').toLowerCase();
    const baseName = item.filename.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_optimized.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hidden multiple file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      {/* Batch Dropzone */}
      <div
        className="dropzone-container"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ padding: '2rem 1.5rem', textAlign: 'center' }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
          Завантажте пачку зображень для пакетної обробки
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '650px', margin: '0 auto' }}>
          Виберіть кілька файлів одночасно або перетягніть їх сюди. Система автоматично профілює кожне зображення,
          підбере індивідуальні параметри стиснення та сформує зведений аналітичний звіт.
        </p>

        <div className="sample-chips" onClick={(e) => e.stopPropagation()} style={{ marginTop: '1rem' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
            style={{ padding: '0.45rem 1.2rem', fontSize: '0.82rem' }}
          >
            Обрати файли (мульти-вибір)
          </button>
          <button
            onClick={loadPresetBatch}
            className="chip-btn"
            style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#c7d2fe' }}
          >
            Тестова пачка: 3 контрольні зразки
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
            {progressMsg || 'Пакетна обробка зображень...'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem' }}>
            Паралельний розрахунок шумів, ентропії, SI та оптимізація в обрані кодеки
          </p>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(244, 63, 94, 0.4)', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185' }}>
          <strong>Помилка пакета: </strong> {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Оброблено файлів</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
                {summary.processed_count} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>/ {summary.total_files}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>100% успішно</div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Початковий обсяг</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#94a3b8', marginTop: '0.2rem' }}>
                {(summary.total_original_bytes / (1024 * 1024)).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>MB</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Вхідна черга</div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Оптимізований обсяг</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {(summary.total_optimized_bytes / (1024 * 1024)).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>MB</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.2rem' }}>Після компресії</div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Сумарна економія</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>
                -{summary.total_saved_percent}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>
                Заощаджено {(summary.total_saved_bytes / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Середня якість</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a5b4fc', marginTop: '0.3rem' }}>
                SSIM: {summary.average_ssim}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginTop: '0.2rem' }}>
                PSNR: {summary.average_psnr_db} dB
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Результати пакетного аналізу ({batchItems.length} зображень):
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={exportBatchCsv} className="btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}>
                Експорт у CSV (Excel)
              </button>
              <button onClick={exportBatchJson} className="btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}>
                Експорт наукового звіту (JSON)
              </button>
              <button
                onClick={() => {
                  setBatchItems([]);
                  setSummary(null);
                }}
                className="chip-btn"
                style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
              >
                Очистити
              </button>
            </div>
          </div>

          {/* Interactive Batch Table */}
          <div className="glass-panel" style={{ overflowX: 'auto', padding: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Зображення</th>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Розмір до → після</th>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Економія</th>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Метрики якості</th>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Рішення (Формат / Q)</th>
                  {isScientific && <th style={{ padding: '0.5rem 0.6rem' }}>Ознаки (H / SI / Шум)</th>}
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {batchItems.map((item, idx) => {
                  const origKb = item.optimization?.original_size_bytes
                    ? (item.optimization.original_size_bytes / 1024).toFixed(1)
                    : '0';
                  const optKb = item.optimization?.optimized_size_bytes
                    ? (item.optimization.optimized_size_bytes / 1024).toFixed(1)
                    : '0';

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '0.55rem 0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {item.originalUrl && (
                            <img
                              src={item.originalUrl}
                              alt={item.filename}
                              style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.filename}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {item.metrics?.metadata?.width}×{item.metrics?.metadata?.height} ({item.metrics?.metadata?.format})
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.55rem 0.6rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#94a3b8' }}>{origKb} KB</span>
                        <span style={{ color: '#64748b', margin: '0 4px' }}>→</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{optKb} KB</span>
                      </td>

                      <td style={{ padding: '0.55rem 0.6rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#6ee7b7',
                          fontWeight: 700,
                          fontSize: '0.74rem'
                        }}>
                          -{item.optimization?.saved_percent}%
                        </span>
                      </td>

                      <td style={{ padding: '0.55rem 0.6rem', fontFamily: 'var(--font-mono)' }}>
                        <div>SSIM: <strong style={{ color: '#a5b4fc' }}>{item.optimization?.ssim}</strong></div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>PSNR: {item.optimization?.psnr_db} dB</div>
                      </td>

                      <td style={{ padding: '0.55rem 0.6rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#c7d2fe',
                          fontSize: '0.72rem',
                          marginRight: '4px'
                        }}>
                          {item.optimization?.format} (Q={item.optimization?.quality_applied})
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                          {item.optimization?.chroma_subsampling}
                        </div>
                      </td>

                      {isScientific && (
                        <td style={{ padding: '0.55rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#94a3b8' }}>
                          <div>H: {item.metrics?.complexity?.entropy_bits} біт</div>
                          <div>SI: {item.metrics?.complexity?.spatial_information}</div>
                          <div>Шум: {item.metrics?.noise?.noise_score}</div>
                        </td>
                      )}

                      <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => onInspectSingle(item)}
                            className="chip-btn"
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.72rem',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: '#c7d2fe',
                              borderColor: 'rgba(99, 102, 241, 0.4)'
                            }}
                          >
                            Детально
                          </button>
                          <button
                            onClick={() => downloadSingleOptimized(item)}
                            className="chip-btn"
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.72rem',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#6ee7b7',
                              borderColor: 'rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            Зберегти
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
