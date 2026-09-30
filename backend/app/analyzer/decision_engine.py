from typing import Dict, Any, List


def determine_optimization_strategy(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent Multi-Criteria Decision Engine for adaptive image optimization.
    Formulates mathematically justified encoding parameters based on numerical
    thresholds of Shannon Entropy, Spatial Information (SI), Noise Variance (Immerkaer & Donoho MAD),
    Laplacian Sharpness, and Color Characteristics.
    """
    meta = metrics["metadata"]
    noise = metrics["noise"]
    complexity = metrics["complexity"]
    sharpness = metrics["sharpness"]
    color = metrics["color"]

    content_type = meta.get("content_type", "Фотографічний контент")
    noise_score = float(noise.get("noise_score", 0.0))
    sigma_imm = float(noise.get("sigma_immerkaer", 0.0))
    sigma_don = float(noise.get("sigma_donoho_haar", 0.0))
    
    complexity_score = float(complexity.get("complexity_score", 0.0))
    entropy = float(complexity.get("entropy_bits", 0.0))
    spatial_info = float(complexity.get("spatial_information", 0.0))
    high_freq_ratio = float(complexity.get("high_freq_ratio", 0.0))
    
    laplacian_var = float(sharpness.get("laplacian_variance", 0.0))
    is_blurry = bool(sharpness.get("is_blurry", False))

    is_flat_graphic = "Graphic" in content_type or "UI" in content_type or "Vector" in content_type

    # Decision Matrix rules collection
    rules: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # 1. EVALUATE SHANNON INFORMATION ENTROPY (H)
    # Threshold: H >= 7.00 (High density), 5.00 <= H < 7.00 (Moderate), H < 5.00 (Low)
    # -------------------------------------------------------------
    if entropy >= 7.00:
        entropy_class = "Висока ентропійна щільність (H ≥ 7.00 біт/пікс)"
        entropy_eval = "Зображення має багатий динамічний розподіл півтонів і високу інформаційну насиченість."
    elif entropy >= 5.00:
        entropy_class = "Помірна ентропійна щільність (5.00 ≤ H < 7.00 біт/пікс)"
        entropy_eval = "Типовий збалансований спектр півтонів природного фотографічного сюжету."
    else:
        entropy_class = "Низька ентропійна щільність (H < 5.00 біт/пікс)"
        entropy_eval = "Присутні великі однотонні сегменти або спрощена колірна палітра."

    rules.append({
        "metric_id": "entropy",
        "name": "Інформаційна ентропія Шеннона (H)",
        "formula": "H = -Σ p(i) · log₂(p(i))",
        "measured_value": f"{entropy:.2f} біт/пікс",
        "numerical_value": entropy,
        "threshold": "H ≥ 7.00 (висока) | 5.00–6.99 (помірна) | < 5.00 (низька)",
        "classification": entropy_class,
        "status": "Виконано" if entropy >= 7.00 else "У діапазоні",
        "decision_impact": entropy_eval
    })

    # -------------------------------------------------------------
    # 2. EVALUATE SPATIAL INFORMATION (SI, ITU-T P.910)
    # Threshold: SI >= 45.0 (High edge activity), 20.0 <= SI < 45.0 (Moderate), SI < 20.0 (Smooth)
    # -------------------------------------------------------------
    if spatial_info >= 45.0:
        si_class = "Висока контурна активність (SI ≥ 45.0)"
        si_eval = "Велика кількість границь, дрібних текстурних елементів і різких перепадів яскравості."
    elif spatial_info >= 20.0:
        si_class = "Помірна контурна активність (20.0 ≤ SI < 45.0)"
        si_eval = "Збалансована просторова динаміка без надмірної концентрації дрібних деталей."
    else:
        si_class = "Низька контурна активність (SI < 20.0)"
        si_eval = "Переважають плавні градієнти, однорідні фони або розмиті площини."

    rules.append({
        "metric_id": "spatial_information",
        "name": "Просторова інформація (SI, ITU-T P.910)",
        "formula": "SI = std( √(Sobel_x² + Sobel_y²) )",
        "measured_value": f"{spatial_info:.2f}",
        "numerical_value": spatial_info,
        "threshold": "SI ≥ 45.0 (висока) | 20.0–44.9 (помірна) | < 20.0 (гладка)",
        "classification": si_class,
        "status": "Висока активність" if spatial_info >= 45.0 else "Норма",
        "decision_impact": si_eval
    })

    # -------------------------------------------------------------
    # 3. COMPOSITE COMPLEXITY & QUANTIZATION PARAMETER (Q / QF / QS)
    # Formula: C_score = min(100, (H / 8) * 45 + min(55, SI * 0.85))
    # Threshold: C_score >= 70 (High) -> Q=80; C_score < 35 (Low) -> Q=88; Else -> Q=84
    # -------------------------------------------------------------
    if is_flat_graphic:
        target_format = "WEBP"
        lossless = True
        recommended_quality = 92
        subsampling = "4:4:4"
        format_rationale_ua = (
            f"Числове обґрунтування: Виявлено графічний/векторний вміст (ентропія H={entropy:.2f}, спектральна "
            f"частка високих частот {high_freq_ratio:.1f}%). Для запобігання артефактам 'дзвону' (Gibbs phenomenon) "
            f"та колірного розмиття на межах тексту обрано кодек WebP із субдискретизацією 4:4:4 без втрат."
        )
        complexity_decision_note = "Векторна/UI графіка: пріоритет збереження різких границь без колірного усереднення."
    else:
        target_format = "WEBP"
        lossless = False
        subsampling = "4:2:0"

        if complexity_score >= 70.0:
            recommended_quality = 80
            format_rationale_ua = (
                f"Числове обґрунтування: Розраховано інтегральну складність C={complexity_score:.1f} (поріг C ≥ 70.0) "
                f"при ентропії H={entropy:.2f} та SI={spatial_info:.1f}. Відповідно до психофізичної моделі "
                f"зорового просторового маскування (Human Visual System spatial masking), людське око неспроможне "
                f"помітити мікроспотворення квантування на щільних текстурах. Тому автоматично обрано Q=80, "
                f"що дає високу компресію без візуального погіршення."
            )
            complexity_decision_note = f"C={complexity_score:.1f} ≥ 70.0 → Класифікація: 'Висока просторова складність' → Дозволено компресію Q=80 (HVS masking)."
        elif complexity_score < 35.0:
            recommended_quality = 88
            format_rationale_ua = (
                f"Числове обґрунтування: Розраховано інтегральну складність C={complexity_score:.1f} (поріг C < 35.0) "
                f"при ентропії H={entropy:.2f} та SI={spatial_info:.1f}. На гладких ділянках агресивне квантування "
                f"спричиняє артефакти ступінчастості (color banding / posterization). Для захисту градієнтів "
                f"автоматично призначено підвищену якість Q=88."
            )
            complexity_decision_note = f"C={complexity_score:.1f} < 35.0 → Класифікація: 'Низька складність / Градієнти' → Підвищена якість Q=88 (захист від banding)."
        else:
            recommended_quality = 84
            format_rationale_ua = (
                f"Числове обґрунтування: Інтегральна складність C={complexity_score:.1f} знаходиться в збалансованому "
                f"діапазоні [35.0…70.0] (H={entropy:.2f}, SI={spatial_info:.1f}). Автоматично встановлено еталонний "
                f"параметр компресії Q=84 із субдискретизацією 4:2:0."
            )
            complexity_decision_note = f"35.0 ≤ C={complexity_score:.1f} < 70.0 → Класифікація: 'Збалансований сюжет' → Базовий параметр Q=84."

    rules.append({
        "metric_id": "complexity_score",
        "name": "Інтегральний індекс просторової складності (C)",
        "formula": "C = min(100, (H / 8) · 45 + min(55, SI · 0.85))",
        "measured_value": f"{complexity_score:.1f} / 100",
        "numerical_value": complexity_score,
        "threshold": "C ≥ 70.0 (висока → Q=80) | C < 35.0 (низька → Q=88) | 35.0–69.9 (Q=84)",
        "classification": "Висока складність" if complexity_score >= 70 else ("Низька складність" if complexity_score < 35 else "Збалансована складність"),
        "status": f"Призначено Q={recommended_quality}",
        "decision_impact": complexity_decision_note
    })

    # -------------------------------------------------------------
    # 4. EVALUATE NOISE (IMMERKAER & DONOHO WAVELET MAD)
    # Threshold: Score > 40.0 (Strong noise), 20.0 < Score <= 40.0 (Mild), Score <= 20.0 (Clean)
    # -------------------------------------------------------------
    if noise_score > 40.0:
        denoise_filter = "bilateral_strong"
        filter_params = {"diameter": 7, "sigmaColor": 40, "sigmaSpace": 40}
        noise_class = f"Критичний рівень високочастотного шуму (Score={noise_score:.1f} > 40.0, σ_imm={sigma_imm:.2f})"
        filter_rationale_ua = (
            f"Числове обґрунтування: Розраховано рівень шуму {noise_score:.1f} > 40.0 (Donoho MAD σ={sigma_don:.2f}, "
            f"Immerkaer σ={sigma_imm:.2f}). Некорельований шум марно витрачає до 40-55% бітрейту. Автоматично активовано "
            f"посилений двовимірний білатеральний фільтр (d=7, σ_r=40, σ_s=40) для очищення фону перед квантуванням."
        )
        noise_action = "Активовано двовимірну білатеральну фільтрацію (d=7, σ_r=40, σ_s=40)"
    elif noise_score > 20.0:
        denoise_filter = "bilateral_mild"
        filter_params = {"diameter": 5, "sigmaColor": 22, "sigmaSpace": 22}
        noise_class = f"Помірний рівень шуму (20.0 < Score={noise_score:.1f} ≤ 40.0)"
        filter_rationale_ua = (
            f"Числове обґрунтування: Виявлено помірний шум {noise_score:.1f} (Donoho MAD σ={sigma_don:.2f}, "
            f"Immerkaer σ={sigma_imm:.2f}). Автоматично застосовано делікатний білатеральний фільтр "
            f"(d=5, σ_r=22, σ_s=22) для придушення мікрошуму без згладжування значущих контурів."
        )
        noise_action = "Активовано м'який білатеральний фільтр (d=5, σ_r=22, σ_s=22)"
    else:
        denoise_filter = "none"
        filter_params = {}
        noise_class = f"Низький шум у межах норми сенсора (Score={noise_score:.1f} ≤ 20.0)"
        filter_rationale_ua = (
            f"Числове обґрунтування: Рівень шуму становить {noise_score:.1f} ≤ 20.0 (σ_imm={sigma_imm:.2f}, "
            f"σ_don={sigma_don:.2f}). Сигнал чистий. Префільтрація не потрібна, щоб уникнути втрати текстурних деталей."
        )
        noise_action = "Префільтрацію вимкнено (оригінальні пікселі збережено 1:1)"

    rules.append({
        "metric_id": "noise_score",
        "name": "Оцінка шуму (Immerkaer Laplacian & Donoho Wavelet MAD)",
        "formula": "N_score = min(100, (σ_imm · 0.5 + σ_don · 0.5) · 5.0)",
        "measured_value": f"{noise_score:.1f} / 100 (σ_imm={sigma_imm:.2f}, σ_don={sigma_don:.2f})",
        "numerical_value": noise_score,
        "threshold": "Score > 40.0 (сильний) | 20.1–40.0 (помірний) | ≤ 20.0 (чисте)",
        "classification": noise_class,
        "status": "Потрібна фільтрація" if noise_score > 20.0 else "Фільтрація не потрібна",
        "decision_impact": noise_action
    })

    # -------------------------------------------------------------
    # 5. EVALUATE SHARPNESS & FOCUS (LAPLACIAN VARIANCE)
    # Threshold: Var < 80.0 (Blurry / Soft), Var >= 80.0 (Sharp)
    # -------------------------------------------------------------
    if is_blurry:
        sharpness_class = f"Зображення нефокусоване або розмите (Var={laplacian_var:.1f} < 80.0)"
        sharpness_impact = "Знижена різкість контурів. Зайве квантування не призведе до артефактів на відсутніх контурах."
    else:
        sharpness_class = f"Висока різкість контурів (Var={laplacian_var:.1f} ≥ 80.0)"
        sharpness_impact = "Контури різкі та чітко виражені, компресор зберігає високочастотні коефіцієнти."

    rules.append({
        "metric_id": "sharpness",
        "name": "Фокус і різкість (Дисперсія оператора Лапласа)",
        "formula": "Var(ΔI) = E[(ΔI - E[ΔI])²]",
        "measured_value": f"{laplacian_var:.1f}",
        "numerical_value": laplacian_var,
        "threshold": "Var ≥ 80.0 (різке) | Var < 80.0 (розмите)",
        "classification": sharpness_class,
        "status": "Різке" if not is_blurry else "Розмите",
        "decision_impact": sharpness_impact
    })

    # -------------------------------------------------------------
    # 6. EVALUATE CHROMA SUBSAMPLING & COLOR SPACE
    # -------------------------------------------------------------
    strip_metadata = True
    convert_to_srgb = color.get("has_icc", False) and "srgb" not in color.get("profile_name", "").lower()
    
    if is_flat_graphic:
        chroma_eval = "Субдискретизація 4:4:4 запобігає колірним ореолам (color bleeding) на межах тексту."
    else:
        chroma_eval = "Субдискретизація 4:2:0 скорочує обсяг колірних каналів на 50% без помітної деградації (модель HVS)."

    rules.append({
        "metric_id": "chroma_subsampling",
        "name": "Колірна субдискретизація (Chroma Subsampling)",
        "formula": "YCbCr Subsampling Ratio (Y:Cb:Cr)",
        "measured_value": subsampling,
        "numerical_value": 444 if subsampling == "4:4:4" else 420,
        "threshold": "Вектор/UI/Шрифти → 4:4:4 | Природне фото → 4:2:0",
        "classification": f"Режим {subsampling}",
        "status": "Оптимально",
        "decision_impact": chroma_eval
    })

    color_rationale_ua = (
        "Числове обґрунтування: Виявлено розширений колірний профіль або надлишкові метадані. Здійснено "
        "конвертацію в стандартизований веб-простір sRGB та видалення EXIF/IPTC тегів для мінімізації розміру файлу."
        if convert_to_srgb else
        "Збережено нормалізований стандартний колірний простір sRGB."
    )

    # Scientific summary paragraph compiling all numbers
    scientific_summary = (
        f"Синтезовано стратегію на базі числових критеріїв: Ентропія H={entropy:.2f} біт/пікс "
        f"({'H ≥ 7.00' if entropy >= 7.00 else ('5.00 ≤ H < 7.00' if entropy >= 5.00 else 'H < 5.00')}), "
        f"Просторова інформація SI={spatial_info:.2f} ({'SI ≥ 45.0' if spatial_info >= 45.0 else 'SI < 45.0'}), "
        f"Інтегральний показник складності C={complexity_score:.1f} → Класифікація: "
        f"{'Висока складність (маскування HVS, Q=80)' if complexity_score >= 70 else ('Низька складність (захист градієнтів, Q=88)' if complexity_score < 35 else 'Збалансований сюжет (Q=84)')}. "
        f"Шум σ={noise_score:.1f} ({'активовано денойз' if noise_score > 20.0 else 'денойз не потрібен'}). "
        f"Формат: {target_format} ({subsampling}, {'Lossless' if lossless else f'Q={recommended_quality}'})."
    )

    return {
        "recommended_format": target_format,
        "is_lossless": lossless,
        "recommended_quality": recommended_quality,
        "chroma_subsampling": subsampling,
        "denoise_filter": denoise_filter,
        "filter_params": filter_params,
        "strip_metadata": strip_metadata,
        "convert_to_srgb": convert_to_srgb,
        "scientific_summary": scientific_summary,
        "decision_matrix": rules,
        "numerical_thresholds": {
            "entropy": {"measured": entropy, "threshold_high": 7.00, "threshold_low": 5.00},
            "spatial_info": {"measured": spatial_info, "threshold_high": 45.0, "threshold_low": 20.0},
            "complexity_score": {"measured": complexity_score, "threshold_high": 70.0, "threshold_low": 35.0},
            "noise_score": {"measured": noise_score, "threshold_strong": 40.0, "threshold_mild": 20.0},
            "laplacian_var": {"measured": laplacian_var, "threshold_sharp": 80.0}
        },
        "explanations": {
            "format": format_rationale_ua,
            "filter": filter_rationale_ua,
            "color": color_rationale_ua
        }
    }
