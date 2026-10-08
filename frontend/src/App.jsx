import React, { useState, useEffect, useRef } from 'react';

import MetricCard from './components/MetricCard';
import DecisionCard from './components/DecisionCard';
import ComparisonSlider from './components/ComparisonSlider';
import HistogramChart from './components/HistogramChart';
import ForensicsStudio from './components/ForensicsStudio';
import BatchProcessor from './components/BatchProcessor';
import UserGuideModal from './components/UserGuideModal';
import AuthModal from './components/AuthModal';
import HistoryDrawer from './components/HistoryDrawer';
import { createSampleImage } from './utils/sampleGenerator';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://diplom-analizer.onrender.com';

export default function App() {
  const [appMode, setAppMode] = useState('single'); // 'single' | 'batch'
  const [viewMode, setViewMode] = useState('simple'); // 'simple' | 'scientific' (like standard vs scientific calculator)
  const [currentFile, setCurrentFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isReoptimizing, setIsReoptimizing] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modals state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  // Authentication state with localStorage persistence
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('optimetrics_token') || '');
  const [currentUser, setCurrentUser] = useState(null);

  const fileInputRef = useRef(null);

  // Check auth session and fetch initial history count
  useEffect(() => {
    if (authToken) {
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.authenticated && data.user) {
            setCurrentUser(data.user);
          } else {
            setAuthToken('');
            setCurrentUser(null);
            localStorage.removeItem('optimetrics_token');
          }
        })
        .catch(() => {});
    }

    // Fetch initial history count
    fetch(`${API_BASE}/api/history?limit=1`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.count !== undefined) {
          setHistoryCount(data.count);
        }
      })
      .catch(() => {});
  }, [authToken]);

  const handleAuthSuccess = (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('optimetrics_token', token);
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    } catch (e) {}
    setCurrentUser(null);
    setAuthToken('');
    localStorage.removeItem('optimetrics_token');
  };

  // Convert File to persistent DataURL for reliable rendering
  const readFileAsDataUrl = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  // Master processing handler for a single image
  const processImageFile = async (file, customStrategy = null) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setLoadingStage('Зчитування та підготовка файлу...');

    try {
      const previewDataUrl = await readFileAsDataUrl(file);
      setOriginalPreviewUrl(previewDataUrl);
      setCurrentFile(file);

      const formData = new FormData();
      formData.append('file', file);
      if (customStrategy) {
        formData.append('custom_strategy', JSON.stringify(customStrategy));
      }

      setLoadingStage('Спектральний аналіз: розрахунок шуму, ентропії, SI та оптимізація...');
      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/api/process-all`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Помилка сервера: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OptiMetrics Process Result:', data);

      if (!data || !data.metrics) {
        throw new Error('Отримано некоректну відповідь від сервера.');
      }

      setAnalysisResult({
        metrics: data.metrics,
        strategy: data.strategy
      });
      setOptimizationResult(data.optimization || null);
      setHistoryCount(prev => prev + 1);
    } catch (err) {
      console.error('Processing error:', err);
      setError(`Не вдалося обробити зображення: ${err.message}. Переконайтеся, що бекенд запущено на ${API_BASE}.`);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // Re-optimize with modified custom strategy (does NOT recalculate metrics or reload whole page)
  const handleReoptimize = async (updatedStrategy) => {
    if (!currentFile) return;
    setIsReoptimizing(true);
    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('custom_strategy', JSON.stringify(updatedStrategy));

      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/api/optimize`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Помилка оптимізації');
      }

      const data = await response.json();
      if (data && data.result) {
        setOptimizationResult(data.result);
      }
      if (data && data.strategy_used) {
        setAnalysisResult((prev) => ({
          ...prev,
          strategy: data.strategy_used
        }));
      }
    } catch (err) {
      console.error('Re-optimization error:', err);
      setError(`Помилка перерахунку стиснення: ${err.message}`);
    } finally {
      setIsReoptimizing(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        setAppMode('batch');
      } else {
        processImageFile(e.dataTransfer.files[0]);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 1) {
        setAppMode('batch');
      } else {
        processImageFile(e.target.files[0]);
      }
    }
  };

  // Preset generator trigger
  const loadPreset = async (presetType) => {
    const file = await createSampleImage(presetType);
    processImageFile(file);
  };

  // Switch to inspect single item from batch processor or history
  const handleInspectSingle = (batchItem) => {
    if (!batchItem) return;
    setCurrentFile(batchItem.originalFile || null);
    setOriginalPreviewUrl(batchItem.originalUrl || batchItem.optimization?.data_url);
    setAnalysisResult({
      metrics: batchItem.metrics,
      strategy: batchItem.strategy
    });
    setOptimizationResult(batchItem.optimization || null);
    setAppMode('single');
  };

  const handleSelectHistoryItem = (historyItem) => {
    if (!historyItem) return;
    setOriginalPreviewUrl(historyItem.thumbnail_url || historyItem.optimization?.data_url);
    setCurrentFile(null); // Saved record from DB
    setAnalysisResult({
      metrics: historyItem.metrics,
      strategy: historyItem.strategy
    });
    setOptimizationResult(historyItem.optimization || null);
    setAppMode('single');
  };

  // Export diploma report as JSON file
  const exportDiplomaReport = () => {
    if (!analysisResult?.metrics || !optimizationResult) return;
    const reportData = {
      project: 'OptiMetrics AI - Adaptive Image Optimization System',
      methodology: 'Multi-criteria decision synthesis based on Shannon Entropy, ITU-T P.910 SI, Immerkaer/Donoho Noise Variance',
      timestamp: new Date().toISOString(),
      user: currentUser ? currentUser.username : 'Guest',
      source_image: analysisResult.metrics.metadata,
      diagnostic_measurements: {
        noise_estimation: analysisResult.metrics.noise,
        complexity_and_entropy: analysisResult.metrics.complexity,
        sharpness_variance: analysisResult.metrics.sharpness,
        color_and_chroma: analysisResult.metrics.color,
      },
      decision_engine: {
        scientific_summary: analysisResult.strategy?.scientific_summary,
        decision_criteria_matrix: analysisResult.strategy?.decision_matrix,
        numerical_thresholds: analysisResult.strategy?.numerical_thresholds,
        strategy_recommendation: {
          format: analysisResult.strategy?.recommended_format,
          quality: analysisResult.strategy?.recommended_quality,
          chroma_subsampling: analysisResult.strategy?.chroma_subsampling,
          is_lossless: analysisResult.strategy?.is_lossless,
          denoise_filter: analysisResult.strategy?.denoise_filter,
          filter_params: analysisResult.strategy?.filter_params,
        },
        explanations: analysisResult.strategy?.explanations,
      },
      experimental_results: {
        target_format: optimizationResult.format,
        quality_factor: optimizationResult.quality_applied,
        pcc_name: optimizationResult.pcc_name,
        pcc_value: optimizationResult.pcc_value,
        chroma_subsampling: optimizationResult.chroma_subsampling,
        is_lossless: optimizationResult.is_lossless,
        original_size_bytes: optimizationResult.original_size_bytes,
        compressed_size_bytes: optimizationResult.optimized_size_bytes,
        compression_ratio_percent: optimizationResult.saved_percent,
        structural_similarity_ssim: optimizationResult.ssim,
        peak_signal_to_noise_ratio_psnr_db: optimizationResult.psnr_db
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptiMetrics_Report_${analysisResult.metrics.metadata?.filename || 'image'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const metrics = analysisResult?.metrics;
  const strategy = analysisResult?.strategy;

  // Safe extraction helpers
  const noiseSigma = Number(metrics?.noise?.sigma ?? ((Number(metrics?.noise?.sigma_immerkaer || 0) + Number(metrics?.noise?.sigma_donoho_haar || 0)) / 2 || (metrics?.noise?.noise_score || 0) / 5.0));
  const noiseVar = Number(metrics?.noise?.variance ?? (noiseSigma * noiseSigma));
  const noiseScore = metrics?.noise?.noise_score ?? Math.min(100, Math.round(noiseSigma * 5.0));
  const noiseLevel = metrics?.noise?.noise_level || 'Не визначено';
  const immerkaerVal = metrics?.noise?.sigma_immerkaer ?? 0;
  const donohoVal = metrics?.noise?.sigma_donoho_haar ?? 0;

  const entropyBits = metrics?.complexity?.entropy_bits ?? 0;
  const spatialInfo = metrics?.complexity?.spatial_information ?? 0;
  const complexityScore = metrics?.complexity?.complexity_score ?? 0;
  const highFreqRatio = metrics?.complexity?.high_freq_ratio ?? 0;

  const sharpnessScore = metrics?.sharpness?.sharpness_score ?? 0;
  const laplaceVar = metrics?.sharpness?.laplacian_variance ?? 0;
  const isBlurry = Boolean(metrics?.sharpness?.is_blurry);

  const chromaStr = metrics?.color?.chroma_subsampling ? String(metrics.color.chroma_subsampling) : 'N/A';
  const chromaShort = chromaStr.split(' ')[0] || chromaStr;
  const colorSpace = metrics?.color?.color_space || 'sRGB';
  const profileName = metrics?.color?.profile_name || 'Standard';

  const contentTypeStr = metrics?.metadata?.content_type ? String(metrics.metadata.content_type) : 'Фото';
  const contentTypeShort = contentTypeStr.split(' ')[0] || contentTypeStr;
  const imgWidth = metrics?.metadata?.width ?? 0;
  const imgHeight = metrics?.metadata?.height ?? 0;
  const imgMegapixels = metrics?.metadata?.megapixels ?? 0;
  const imgAspectRatio = metrics?.metadata?.aspect_ratio ?? 1;
  const imgFormat = metrics?.metadata?.format || '';

  return (
    <div>
      {/* Navigation Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo-group">
            <div className="logo-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px', flexWrap: 'wrap' }}>
                <span className="logo-badge">ДИПЛОМНИЙ ПРОЄКТ</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Адаптивна підготовка та оптимізація медіаконтенту
                </span>
              </div>
            </div>
          </div>

          {/* Center: Mode Selectors (Single vs Batch & Simple vs Scientific) */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Primary Mode: Single vs Batch */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setAppMode('single')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: appMode === 'single' ? 'var(--primary)' : 'transparent',
                  color: appMode === 'single' ? '#fff' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Одиночний аналіз
              </button>
              <button
                onClick={() => setAppMode('batch')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: appMode === 'batch' ? 'var(--primary)' : 'transparent',
                  color: appMode === 'batch' ? '#fff' : '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Пакетна обробка пачки
              </button>
            </div>

            {/* View Style: Simple vs Scientific (like standard vs scientific calculator) */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setViewMode('simple')}
                title="Лаконічний вигляд без складних формул і розгорнутих матриць"
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  background: viewMode === 'simple' ? 'rgba(99,102,241,0.35)' : 'transparent',
                  color: viewMode === 'simple' ? '#fff' : '#94a3b8',
                  border: viewMode === 'simple' ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Базовий
              </button>
              <button
                onClick={() => setViewMode('scientific')}
                title="Повний науковий апарат: формули, пороги, матриця рішень"
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  background: viewMode === 'scientific' ? 'rgba(99,102,241,0.35)' : 'transparent',
                  color: viewMode === 'scientific' ? '#fff' : '#94a3b8',
                  border: viewMode === 'scientific' ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Науковий (розширений)
              </button>
            </div>
          </div>

          {/* Right Action buttons: History, Guide, Auth, Export, Upload */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* History drawer trigger */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>Історія</span>
              {historyCount > 0 && (
                <span style={{
                  background: '#6366f1',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 700
                }}>
                  {historyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsGuideOpen(true)}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1'
              }}
            >
              Інструкція та методологія
            </button>

            {/* Auth Login / Register Profile */}
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{
                  fontSize: '0.78rem',
                  color: '#a5b4fc',
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  {currentUser.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="chip-btn"
                  title="Вийти з акаунта"
                  style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)', padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
                >
                  Вийти
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="chip-btn"
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7'
                }}
              >
                Увійти
              </button>
            )}

            {appMode === 'single' && optimizationResult && (
              <button onClick={exportDiplomaReport} className="btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
                Експорт звіту
              </button>
            )}

            {appMode === 'single' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Завантажити файл
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-layout">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* -------------------------------------------------------------
            MODE A: BATCH PROCESSING OF MULTIPLE IMAGES
           ------------------------------------------------------------- */}
        {appMode === 'batch' ? (
          <BatchProcessor
            apiBase={API_BASE}
            onInspectSingle={handleInspectSingle}
            isScientific={viewMode === 'scientific'}
            authToken={authToken}
          />
        ) : (
          /* -------------------------------------------------------------
              MODE B: SINGLE IMAGE DEEP ASSESSMENT & OPTIMIZATION
             ------------------------------------------------------------- */
          <>
            {/* Hero Dropzone & Quick Presets */}
            <div
              className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                Перетягніть сюди файл зображення або клікніть для вибору
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                Підтримуються формати JPEG, PNG, WebP. Система автоматично проведе математичну оцінку шуму, ентропії, просторової складності та підбере оптимальні параметри компресії.
              </p>

              {/* Preset Buttons for Quick Testing */}
              <div className="sample-chips" onClick={(e) => e.stopPropagation()}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Контрольні зразки:</span>
                <button onClick={() => loadPreset('photo')} className="chip-btn">
                  Зразок: Фотографічне зображення
                </button>
                <button onClick={() => loadPreset('graphic')} className="chip-btn">
                  Зразок: Векторна графіка (4:4:4)
                </button>
                <button onClick={() => loadPreset('noisy')} className="chip-btn">
                  Зразок: Зашумлене зображення
                </button>
              </div>
            </div>

            {/* Loading overlay indicator (ONLY on initial image upload/full metric analysis) */}
            {loading && (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  {loadingStage || 'Обробка та оцінка параметрів...'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                  Обчислення алгоритмів Immerkaer, Donoho Haar MAD, ITU-T SI та валідація SSIM
                </p>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(244, 63, 94, 0.4)', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185' }}>
                <div>
                  <strong>Повідомлення системи: </strong> {error}
                </div>
              </div>
            )}

            {/* Results Sections - Ordered logically:
                1. Image assessment information & histograms (FIRST)
                2. Decision synthesis & manual / auto mode (SECOND)
                3. Preview comparison & forensics (THIRD) */}
            {metrics && !loading && (
              <>
                {/* 1. ДІАГНОСТИЧНЕ ПРОФІЛЮВАННЯ ЗОБРАЖЕННЯ (ПЕРШИМ) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                        1. Математичне профілювання характеристик зображення
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        Оцінені параметри сигналу (ентропія, шум, просторова складність), на основі яких синтезується стратегія
                      </p>
                    </div>
                  </div>

                  <div className="metrics-grid">
                    {/* Metric 1: Noise Level */}
                    <MetricCard
                      title="Рівень шуму (СКВ σ та дисперсія σ²)"
                      badge={`Var = ${noiseVar.toFixed(1)}`}
                      badgeType={noiseSigma > 8.0 ? 'alert' : (noiseSigma > 4.0 ? 'warning' : 'clean')}
                      value={noiseSigma.toFixed(2)}
                      unit="σ (градації)"
                      description={`Середньоквадратичне відхилення шуму σ=${noiseSigma.toFixed(2)} (дисперсія σ²=${noiseVar.toFixed(1)}). Donoho MAD: σ=${donohoVal}, Immerkaer: σ=${immerkaerVal}.`}
                      formula="σ_avg = (σ_imm + σ_don) / 2, Var = σ² (AWGN std)"
                      progress={Math.min(100, (noiseSigma / 12.0) * 100)}
                      progressColor={noiseSigma > 8.0 ? 'linear-gradient(90deg, #f59e0b, #f43f5e)' : 'linear-gradient(90deg, #10b981, #06b6d4)'}
                      isScientific={viewMode === 'scientific'}
                    />

                    {/* Metric 2: Spatial Information & Complexity */}
                    <MetricCard
                      title="Просторова складність (SI)"
                      badge={`SI = ${spatialInfo}`}
                      badgeType="info"
                      value={complexityScore}
                      unit="/ 100"
                      description={`Високочастотна спектральна енергія FFT: ${highFreqRatio}%.`}
                      formula="ITU-T P.910 (Sobel gradient std) + 2D FFT"
                      progress={complexityScore}
                      progressColor="linear-gradient(90deg, #6366f1, #a855f7)"
                      isScientific={viewMode === 'scientific'}
                    />

                    {/* Metric 3: Shannon Information Entropy */}
                    <MetricCard
                      title="Інформаційна ентропія Шеннона"
                      badge={`${Math.round((entropyBits / 8.0) * 100)}% ємності`}
                      badgeType="info"
                      value={entropyBits}
                      unit="bits / pixel"
                      description="Теоретичний мінімум кількості бітів для представлення градацій яскравості без втрат."
                      formula="H = -Σ p(i) · log₂(p(i)) (макс 8.0 біт)"
                      progress={(entropyBits / 8.0) * 100}
                      progressColor="linear-gradient(90deg, #06b6d4, #3b82f6)"
                      isScientific={viewMode === 'scientific'}
                    />

                    {/* Metric 4: Sharpness & Blur */}
                    <MetricCard
                      title="Різкість (Sharpness / Blur)"
                      badge={isBlurry ? 'Розмито' : 'Різке'}
                      badgeType={isBlurry ? 'warning' : 'clean'}
                      value={sharpnessScore}
                      unit="/ 100"
                      description={`Дисперсія оператора Лапласа Var(ΔI) = ${laplaceVar}.`}
                      formula="Laplacian Variance Focus Measure"
                      progress={sharpnessScore}
                      progressColor="linear-gradient(90deg, #10b981, #6366f1)"
                      isScientific={viewMode === 'scientific'}
                    />

                    {/* Metric 5: Chroma Subsampling & Color Space */}
                    <MetricCard
                      title="Субдискретизація кольору"
                      badge={chromaShort}
                      badgeType={chromaStr.includes('4:4:4') ? 'clean' : 'info'}
                      value={chromaShort}
                      unit=""
                      description={`Простір кольору: ${colorSpace}. Профіль: ${profileName}.`}
                      formula="JPEG SOF Marker Parsing & ICC Profile Inspection"
                      progress={chromaStr.includes('4:4:4') ? 100 : 50}
                      progressColor="linear-gradient(90deg, #38bdf8, #818cf8)"
                      isScientific={viewMode === 'scientific'}
                    />

                    {/* Metric 6: Classification & Dimensions */}
                    <MetricCard
                      title="Класифікація контенту"
                      badge={`${imgWidth}×${imgHeight}`}
                      badgeType="clean"
                      value={contentTypeShort}
                      unit={`(${imgMegapixels} MP)`}
                      description={`Співвідношення сторін: ${imgAspectRatio}:1. Вихідний формат: ${imgFormat}.`}
                      formula="Color Diversity & Edge Gradient Density Ratio"
                      progress={75}
                      progressColor="linear-gradient(90deg, #ec4899, #8b5cf6)"
                      isScientific={viewMode === 'scientific'}
                    />
                  </div>
                </div>

                {/* Гістограми розподілу каналів */}
                {metrics.histograms && <HistogramChart histograms={metrics.histograms} />}

                {/* 2. МОДУЛЬ СИНТЕЗУ РІШЕНЬ ТА РУЧНОГО ВИБОРУ (ДРУГИМ) */}
                {strategy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                      2. Модуль оптимізації та вибору режиму кодування
                    </h3>
                    <DecisionCard
                      strategy={strategy}
                      onReoptimize={handleReoptimize}
                      isProcessing={isReoptimizing}
                      isScientific={viewMode === 'scientific'}
                    />
                  </div>
                )}

                {/* 3. ПОПЕРЕДНІЙ ПЕРЕГЛЯД ТА ФОРЕНЗИКА (ТРЕТІМ) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                      3. Попередній перегляд оптимізації та контроль артефактів
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Порівняння початкового та стисненого файлу (SSIM / PSNR) та форензичний аудит
                    </p>
                  </div>

                  {/* Comparison Studio (Before vs After) */}
                  <ComparisonSlider
                    originalUrl={originalPreviewUrl}
                    optimizedUrl={optimizationResult?.data_url}
                    meta={metrics.metadata}
                    optimization={optimizationResult}
                    isUpdating={isReoptimizing}
                  />

                  {/* Forensics Studio & Pixel Loupe Magnifier */}
                  <ForensicsStudio
                    file={currentFile}
                    originalUrl={originalPreviewUrl}
                  />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* User Guide & Decision Methodology Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Authentication Login / Register Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        apiBase={API_BASE}
      />

      {/* Analysis History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        apiBase={API_BASE}
        authToken={authToken}
        onSelectHistoryItem={handleSelectHistoryItem}
        onHistoryCountChange={setHistoryCount}
      />
    </div>
  );
}
