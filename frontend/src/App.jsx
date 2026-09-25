import React, { useState, useRef } from 'react';

import MetricCard from './components/MetricCard';
import DecisionCard from './components/DecisionCard';
import ComparisonSlider from './components/ComparisonSlider';
import HistogramChart from './components/HistogramChart';
import ForensicsStudio from './components/ForensicsStudio';
import { createSampleImage } from './utils/sampleGenerator';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [currentFile, setCurrentFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Convert File to persistent DataURL for reliable rendering
  const readFileAsDataUrl = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  // Master processing handler
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
      const response = await fetch(`${API_BASE}/api/process-all`, {
        method: 'POST',
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
    } catch (err) {
      console.error('Processing error:', err);
      setError(`Не вдалося обробити зображення: ${err.message}. Переконайтеся, що бекенд запущено на ${API_BASE}.`);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // Re-optimize with modified custom strategy
  const handleReoptimize = async (updatedStrategy) => {
    if (!currentFile) return;
    setLoading(true);
    setLoadingStage('Перерахунок стиснення та валідація SSIM/PSNR...');
    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('custom_strategy', JSON.stringify(updatedStrategy));

      const response = await fetch(`${API_BASE}/api/optimize`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Помилка оптимізації');
      }

      const data = await response.json();
      setOptimizationResult(data.result);
      setAnalysisResult((prev) => ({
        ...prev,
        strategy: data.strategy_used
      }));
    } catch (err) {
      console.error(err);
      setError(`Помилка перерахунку: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStage('');
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
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  // Preset generator trigger
  const loadPreset = async (presetType) => {
    const file = await createSampleImage(presetType);
    processImageFile(file);
  };

  // Export diploma report as JSON file
  const exportDiplomaReport = () => {
    if (!analysisResult?.metrics || !optimizationResult) return;
    const reportData = {
      project: 'OptiMetrics AI - Adaptive Image Optimization System',
      timestamp: new Date().toISOString(),
      source_image: analysisResult.metrics.metadata,
      diagnostic_measurements: {
        noise_estimation: analysisResult.metrics.noise,
        complexity_and_entropy: analysisResult.metrics.complexity,
        sharpness_variance: analysisResult.metrics.sharpness,
        color_and_chroma: analysisResult.metrics.color,
      },
      decision_engine_rules: analysisResult.strategy,
      experimental_results: {
        target_format: optimizationResult.format,
        quality_factor: optimizationResult.quality_applied,
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
  const noiseScore = metrics?.noise?.noise_score ?? 0;
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                <span className="logo-badge">ДИПЛОМНИЙ ПРОЄКТ</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Адаптивна підготовка та оптимізація медіаконтенту
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {optimizationResult && (
              <button onClick={exportDiplomaReport} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Експорт наукового звіту (JSON)
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
              style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
            >
              Завантажити файл
            </button>
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
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Контрольні зразки для тестування:</span>
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

        {/* Loading overlay indicator */}
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

        {/* Results Sections */}
        {metrics && !loading && (
          <>
            {/* 1. Comparison Studio (Before vs After) */}
            <ComparisonSlider
              originalUrl={originalPreviewUrl}
              optimizedUrl={optimizationResult?.data_url}
              meta={metrics.metadata}
              optimization={optimizationResult}
            />

            {/* 2. Forensics Studio & Pixel Loupe Magnifier */}
            <ForensicsStudio
              file={currentFile}
              originalUrl={originalPreviewUrl}
            />

            {/* 3. Intelligent Decision Engine Recommendation Banner */}
            {strategy && (
              <DecisionCard
                strategy={strategy}
                onReoptimize={handleReoptimize}
                isProcessing={loading}
              />
            )}

            {/* 4. Diagnostic Metrics Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  Результати математичного профілювання зображення
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                  Ключові параметри, на основі яких синтезується стратегія адаптивної фільтрації та компресії:
                </p>
              </div>

              <div className="metrics-grid">
                {/* Metric 1: Noise Level */}
                <MetricCard
                  title="Оцінка рівня шуму"
                  badge={noiseLevel}
                  badgeType={noiseScore > 35 ? 'alert' : (noiseScore > 20 ? 'warning' : 'clean')}
                  value={noiseScore}
                  unit="/ 100"
                  description={`Медіанне відхилення Donoho MAD: σ=${donohoVal}, Immerkaer: σ=${immerkaerVal}.`}
                  formula="J. Immerkaer Fast Noise & 2D Haar Wavelet MAD"
                  progress={noiseScore}
                  progressColor={noiseScore > 35 ? 'linear-gradient(90deg, #f59e0b, #f43f5e)' : 'linear-gradient(90deg, #10b981, #06b6d4)'}
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
                />
              </div>
            </div>

            {/* 5. Color & Luminance Histogram */}
            {metrics.histograms && <HistogramChart histograms={metrics.histograms} />}
          </>
        )}
      </main>
    </div>
  );
}
