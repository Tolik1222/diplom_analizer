import React, { useState } from 'react';

export default function UserGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('instructions');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              Інструкція користувача та науково-методичне обґрунтування
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Керівництво з експлуатації системи та числові пороги автоматичного синтезу рішень
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Закрити">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs">
          <button
            className={`modal-tab-btn ${activeTab === 'instructions' ? 'active' : ''}`}
            onClick={() => setActiveTab('instructions')}
          >
            Покрокова інструкція
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'thresholds' ? 'active' : ''}`}
            onClick={() => setActiveTab('thresholds')}
          >
            Числові пороги та правила рішень
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'math' ? 'active' : ''}`}
            onClick={() => setActiveTab('math')}
          >
            Математичний апарат метрик
          </button>
          <button
            className={`modal-tab-btn ${activeTab === 'codecs' ? 'active' : ''}`}
            onClick={() => setActiveTab('codecs')}
          >
            Довідник кодеків та PCC
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* TAB 1: USER INSTRUCTIONS */}
          {activeTab === 'instructions' && (
            <div className="guide-section">
              <h3 className="guide-section-title">Порядок роботи з веб-додатком</h3>
              <p className="guide-lead-text">
                Система реалізує повний замкнений цикл інтелектуальної оцінки якості, форензичного аудиту та
                адаптивної підготовки цифрових зображень.
              </p>

              <div className="guide-steps-list">
                <div className="guide-step-card">
                  <div className="guide-step-num">1</div>
                  <div>
                    <h4 className="guide-step-title">Завантаження зображення</h4>
                    <p className="guide-step-desc">
                      Перетягніть файл у робочу область або скористайтеся кнопкою <strong>«Завантажити файл»</strong>.
                      Також доступні готові <strong>контрольні зразки</strong> (природне фото, векторна графіка 4:4:4,
                      високозашумлене зображення) для моментального тестування алгоритмів.
                    </p>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-num">2</div>
                  <div>
                    <h4 className="guide-step-title">Автоматичне профілювання характеристик</h4>
                    <p className="guide-step-desc">
                      Серверний рушій обчислює повний вектор діагностичних метрик: рівень шуму за двома незалежними
                      методами (Іммеркаєр і хвильковий Donoho MAD), просторову інформацію ITU-T SI, ентропію Шеннона,
                      дисперсію Лапласіана (різкість), 2D FFT спектр та витягує таблиці субдискретизації SOF.
                    </p>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-num">3</div>
                  <div>
                    <h4 className="guide-step-title">Форензична діагностика та екранна лупа</h4>
                    <p className="guide-step-desc">
                      У студії форензики доступні 11 спеціалізованих фільтрів (ELA аналіз рівнів помилок, карти шуму,
                      градієнт яскравості, аналіз головних компонент PCA, зріз бітових площин LSB для стеганографії,
                      детекція клонованих фрагментів). Наведіть курсор на зображення для активації <strong>Pixel Magnifier</strong> із
                      зумом 8×, точними координатами, HEX/RGB значеннями та локальною гістограмою.
                    </p>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-num">4</div>
                  <div>
                    <h4 className="guide-step-title">Аналіз синтезованого рішення або ручний вибір кодека</h4>
                    <p className="guide-step-desc">
                      У блоці <strong>«Модуль автоматичного синтезу рішень»</strong> відображається точне числове
                      обґрунтування вибраного кодека, якості Q та фільтрації. При перемиканні в <strong>ручний режим</strong> ви
                      можете дослідити поведінку кодеків WebP, JPEG, PNG, BPG (Q=1…51), AGU та ADCT (крок QS).
                    </p>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-num">5</div>
                  <div>
                    <h4 className="guide-step-title">Інтерактивне порівняння До / Після</h4>
                    <p className="guide-step-desc">
                      Слайдер порівняння у режимі реального часу дозволяє візуально оцінити межу спотворень. У верхній
                      панелі виводяться об'єктивні метрики: розмір до/після, ступінь стиснення, коефіцієнт структурної
                      подібності <strong>SSIM</strong> та пікове відношення сигнал/шум <strong>PSNR (дБ)</strong>.
                    </p>
                  </div>
                </div>

                <div className="guide-step-card">
                  <div className="guide-step-num">6</div>
                  <div>
                    <h4 className="guide-step-title">Експорт наукового звіту</h4>
                    <p className="guide-step-desc">
                      Натисніть <strong>«Експорт наукового звіту (JSON)»</strong> у верхньому правому куті, щоб завантажити
                      структурований файл з усіма обчисленими метриками, пороговими перевірками та результатом стиснення.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NUMERICAL THRESHOLDS & DECISION RULES */}
          {activeTab === 'thresholds' && (
            <div className="guide-section">
              <h3 className="guide-section-title">Матриця числових критеріїв та правил автоматичних рішень</h3>
              <p className="guide-lead-text">
                Автоматичні рішення системи базуються не на евристиках, а на строгих числових інтервалах і
                психофізичних моделях сприйняття людської зорової системи (Human Visual System, HVS).
              </p>

              <div className="guide-table-wrapper">
                <table className="guide-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Параметр і формула</th>
                      <th style={{ width: '20%' }}>Числовий поріг</th>
                      <th style={{ width: '26%' }}>Класифікація контенту</th>
                      <th style={{ width: '32%' }}>Автоматичне рішення системи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ENTROPY */}
                    <tr>
                      <td>
                        <strong>Ентропія Шеннона (H)</strong>
                        <div className="guide-table-formula">H = -Σ p(i) log₂(p(i))</div>
                      </td>
                      <td>
                        <span className="guide-badge-high">H ≥ 7.00 біт</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-mid">5.00 ≤ H &lt; 7.00 біт</span></div>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-low">H &lt; 5.00 біт</span></div>
                      </td>
                      <td>
                        <strong>H ≥ 7.00:</strong> Висока ентропійна щільність (багатий спектр півтонів).<br/>
                        <strong>5.00–6.99:</strong> Помірна ентропія (типове фото).<br/>
                        <strong>&lt; 5.00:</strong> Низька ентропія (однотонні зони, графіка).
                      </td>
                      <td>
                        У поєднанні з показником SI визначає інтегральний індекс складності <code>C_score</code>.
                        Для низької ентропії з однорідними областями підвищується якість Q щоб запобігти артефактам.
                      </td>
                    </tr>

                    {/* SPATIAL INFORMATION */}
                    <tr>
                      <td>
                        <strong>Просторова інформація (SI)</strong>
                        <div className="guide-table-formula">SI = std(√(Sobel_x² + Sobel_y²))</div>
                        <div className="guide-table-ref">Стандарт ITU-T P.910</div>
                      </td>
                      <td>
                        <span className="guide-badge-high">SI ≥ 45.0</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-mid">20.0 ≤ SI &lt; 45.0</span></div>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-low">SI &lt; 20.0</span></div>
                      </td>
                      <td>
                        <strong>SI ≥ 45.0:</strong> Висока контурна активність (трава, листя, архітектура, дрібні деталі).<br/>
                        <strong>20.0–44.9:</strong> Середня динаміка.<br/>
                        <strong>&lt; 20.0:</strong> Гладкі площини (небо, студійний фон).
                      </td>
                      <td>
                        Високий показник SI сигналізує про наявність значної кількості високочастотних складових.
                        Визначає схильність до просторового зорового маскування шумів квантування.
                      </td>
                    </tr>

                    {/* COMPLEXITY SCORE & QUALITY */}
                    <tr style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                      <td>
                        <strong>Інтегральна складність (C)</strong>
                        <div className="guide-table-formula">C = min(100, (H/8)·45 + min(55, SI·0.85))</div>
                      </td>
                      <td>
                        <span className="guide-badge-high">C ≥ 70.0</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-low">C &lt; 35.0</span></div>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-mid">35.0 ≤ C &lt; 70.0</span></div>
                      </td>
                      <td>
                        <strong>C ≥ 70.0:</strong> Висока просторово-текстурна складність.<br/>
                        <strong>C &lt; 35.0:</strong> Низька складність / Плавні градієнти.<br/>
                        <strong>35.0–69.9:</strong> Збалансований сюжет.
                      </td>
                      <td>
                        <strong>C ≥ 70.0 → Вибір Q = 80:</strong> Працює ефект просторового маскування HVS (людське око не помічає похибок квантування в текстурах), досягається високе стиснення.<br/>
                        <strong>C &lt; 35.0 → Вибір Q = 88..90:</strong> Підвищена якість для усунення смугастості (color banding) на градієнтах.<br/>
                        <strong>35.0–69.9 → Вибір Q = 84:</strong> Еталонний компроміс якість/бітрейт.
                      </td>
                    </tr>

                    {/* NOISE ESTIMATION & DENOISE */}
                    <tr>
                      <td>
                        <strong>Оцінка шуму (N_score)</strong>
                        <div className="guide-table-formula">σ_imm (Laplace mask) + σ_don (Haar MAD)</div>
                      </td>
                      <td>
                        <span className="guide-badge-alert">Score &gt; 40.0 (σ &gt; 8.0)</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-mid">20.0 &lt; Score ≤ 40.0</span></div>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-clean">Score ≤ 20.0 (σ ≤ 4.0)</span></div>
                      </td>
                      <td>
                        <strong>&gt; 40.0:</strong> Критичний високочастотний шум.<br/>
                        <strong>20.1–40.0:</strong> Помірний шум сенсора.<br/>
                        <strong>≤ 20.0:</strong> Чистий сигнал (шум у нормі).
                      </td>
                      <td>
                        <strong>Score &gt; 40.0:</strong> Активація посиленого 2D білатерального фільтра (d=7, σ_r=40, σ_s=40). Без цього до 50% бітрейту витрачається на шум!<br/>
                        <strong>20.1–40.0:</strong> М'яка білатеральна фільтрація (d=5, σ_r=22, σ_s=22).<br/>
                        <strong>≤ 20.0:</strong> Фільтрацію вимкнено (оригінальні пікселі збережено 1:1).
                      </td>
                    </tr>

                    {/* CHROMA SUBSAMPLING */}
                    <tr>
                      <td>
                        <strong>Субдискретизація колірності</strong>
                        <div className="guide-table-formula">YCbCr Subsampling Ratio</div>
                      </td>
                      <td>
                        <span className="guide-badge-mid">Графіка: D_col &lt; 0.08, H &lt; 6.8</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-mid">Фото: Природні сюжети</span></div>
                      </td>
                      <td>
                        <strong>Вектор / UI / Текст:</strong> Висококонтрастні межі символів.<br/>
                        <strong>Фото:</strong> Безперервні колірні переходи.
                      </td>
                      <td>
                        <strong>Графіка → Субдискретизація 4:4:4 або Lossless:</strong> Запобігає колірному ореолу (color bleeding) на межах шрифтів.<br/>
                        <strong>Фото → Субдискретизація 4:2:0:</strong> Скорочує колірні байти Cb/Cr на 50% без помітної оком деградації.
                      </td>
                    </tr>

                    {/* SHARPNESS */}
                    <tr>
                      <td>
                        <strong>Різкість (Лапласіан)</strong>
                        <div className="guide-table-formula">Var(ΔI) = дисперсія оператора Лапласа</div>
                      </td>
                      <td>
                        <span className="guide-badge-clean">Var ≥ 80.0 (Різке)</span>
                        <div style={{ marginTop: '4px' }}><span className="guide-badge-alert">Var &lt; 80.0 (Розмите)</span></div>
                      </td>
                      <td>
                        <strong>Var ≥ 80.0:</strong> Висока фокусна різкість.<br/>
                        <strong>Var &lt; 80.0:</strong> Зображення нефокусоване або розмите.
                      </td>
                      <td>
                        Фіксується в діагностичному звіті. Для розмитих зображень усувається надлишкове підвищення бітрейту на неіснуючі деталі.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MATHEMATICAL APPARATUS */}
          {activeTab === 'math' && (
            <div className="guide-section">
              <h3 className="guide-section-title">Математичні моделі та алгоритми аналізу</h3>
              <p className="guide-lead-text">
                Нижче наведено теоретичні формули алгоритмів, реалізованих у модулях комп'ютерного зору бекенду.
              </p>

              <div className="guide-math-grid">
                <div className="guide-math-card">
                  <h4>1. Оцінювач дисперсії шуму Й. Іммеркаєра (1996)</h4>
                  <div className="guide-math-eq">
                    N_mask = [[1, -2, 1], [-2, 4, -2], [1, -2, 1]]
                  </div>
                  <div className="guide-math-eq">
                    σ = ( Σ |I * N_mask| · √(π / 2) ) / ( 6 · (W - 2) · (H - 2) )
                  </div>
                  <p>
                    Швидка беззразкова оцінка дисперсії адитивного гаусового білого шуму (AWGN) без попереднього
                    знання вихідного сигналу шляхом застосування лапласоподібної маски, ортогональної до лінійних градієнтів.
                  </p>
                </div>

                <div className="guide-math-card">
                  <h4>2. Хвильковий оцінювач Донахо (Donoho Wavelet MAD)</h4>
                  <div className="guide-math-eq">
                    HH1 = ( I[2x, 2y] - I[2x+1, 2y] - I[2x, 2y+1] + I[2x+1, 2y+1] ) / 2
                  </div>
                  <div className="guide-math-eq">
                    σ = Median( |HH1| ) / 0.6745
                  </div>
                  <p>
                    Стійкий (робастний) оцінювач шуму на основі медіани абсолютних відхилень (MAD) у діагональному
                    високочастотному піддіапазоні HH першого рівня двовимірного перетворення Хаара.
                  </p>
                </div>

                <div className="guide-math-card">
                  <h4>3. Просторова інформація (Spatial Information, ITU-T P.910)</h4>
                  <div className="guide-math-eq">
                    Sobel_mag(x, y) = √( Sobel_x(I)² + Sobel_y(I)² )
                  </div>
                  <div className="guide-math-eq">
                    SI = Standard_Deviation( Sobel_mag )
                  </div>
                  <p>
                    Міжнародний стандарт ITU-T для кількісної оцінки просторової деталізації та контурної активності
                    зображень і відеокадрів.
                  </p>
                </div>

                <div className="guide-math-card">
                  <h4>4. Інформаційна ентропія Шеннона</h4>
                  <div className="guide-math-eq">
                    H = - Σ [ p(g) · log₂( p(g) ) ]  для g ∈ [0..255]
                  </div>
                  <p>
                    Визначає теоретичну нижню межу бітової ємності для кодування градацій яскравості без втрат.
                    Максимальне теоретичне значення для 8-бітного каналу становить 8.00 біт/піксель.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CODEC REFERENCE */}
          {activeTab === 'codecs' && (
            <div className="guide-section">
              <h3 className="guide-section-title">Довідник кодеків та метрик валідації стиснення</h3>
              <p className="guide-lead-text">
                Система підтримує як загальноприйняті сучасні веб-формати, так і спеціалізовані кафедральні кодеки
                з повним контролем простору параметрів.
              </p>

              <div className="guide-codecs-grid">
                <div className="guide-codec-box">
                  <h4>WebP (Google)</h4>
                  <div className="guide-codec-pcc">PCC: Q ∈ [0…100], Lossless, 4:4:4 / 4:2:0</div>
                  <p>
                    Сучасний веб-стандарт на базі внутрикадрового прогнозування VP8. Забезпечує на 25-35% краще
                    стиснення порівняно з JPEG при збереженні високої якості.
                  </p>
                </div>

                <div className="guide-codec-box">
                  <h4>JPEG (Progressive DCT)</h4>
                  <div className="guide-codec-pcc">PCC: QF ∈ [1…100], 4:4:4 / 4:2:2 / 4:2:0</div>
                  <p>
                    Класичний стандарт з 8×8 дискретним косинусним перетворенням. Підтримує прогресивний рендеринг
                    та дослідження квантування високочастотних матриць.
                  </p>
                </div>

                <div className="guide-codec-box">
                  <h4>PNG (Deflate / zlib)</h4>
                  <div className="guide-codec-pcc">PCC: Level ∈ [0…9], Завжди Lossless, 4:4:4</div>
                  <p>
                    Еталонний формат стиснення без втрат. Зміна параметра змінює лише час компресії контейнера,
                    а не візуальну якість пікселів.
                  </p>
                </div>

                <div className="guide-codec-box">
                  <h4>BPG (Better Portable Graphics)</h4>
                  <div className="guide-codec-pcc">PCC: Q ∈ [1…51] (більше Q — сильніше стиснення)</div>
                  <p>
                    Кафедральний кодек на основі HEVC/H.265 Intra-frame кодування з блоками до 32×32 пікселів.
                    Еталонний інструмент дослідження R-D характеристик.
                  </p>
                </div>

                <div className="guide-codec-box">
                  <h4>AGU (Adaptive Group Utilities)</h4>
                  <div className="guide-codec-pcc">PCC: QS ∈ [0.5…200] (крок квантування)</div>
                  <p>
                    Кафедральний кодек на основі 32×32 DCT перетворення та спектрального адаптивного квантування
                    із класифікацією блоків за текстурною складністю.
                  </p>
                </div>

                <div className="guide-codec-box">
                  <h4>ADCT (Advanced Discrete Cosine Transform)</h4>
                  <div className="guide-codec-pcc">PCC: QS ∈ [0.5…200] (крок квантування)</div>
                  <p>
                    Кодек з ієрархічним розбиттям та оптимізованим ентропійним кодуванням коефіцієнтів DCT.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: '10px' }}>
                <h4 style={{ color: '#a5b4fc', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  Метрики оцінки якості стиснення
                </h4>
                <ul style={{ paddingLeft: '1.25rem', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.7' }}>
                  <li>
                    <strong>SSIM (Structural Similarity Index):</strong> Оцінює схожість за яскравістю, контрастом і
                    структурою. Значення <code>1.000</code> — ідентичні зображення; <code>&gt; 0.95</code> — практично
                    непомітні спотворення для ока.
                  </li>
                  <li>
                    <strong>PSNR (Peak Signal-to-Noise Ratio):</strong> Пікове відношення сигналу до шуму в дБ.
                    Значення <code>&gt; 38–42 дБ</code> свідчить про високу якість кодування.
                  </li>
                  <li>
                    <strong>CR (Compression Ratio) та Saved %:</strong> Відношення початкового розміру до оптимізованого
                    та відсоток економії пам'яті для серверного сховища.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Дипломний проєкт: Адаптивна підготовка та оптимізація медіаконтенту
          </span>
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}>
            Зрозуміло, закрити
          </button>
        </div>
      </div>
    </div>
  );
}
