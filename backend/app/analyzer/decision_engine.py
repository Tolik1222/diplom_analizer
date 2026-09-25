from typing import Dict, Any


def determine_optimization_strategy(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligent Decision Engine for adaptive image optimization.
    Evaluates noise, complexity, sharpness, and content classification to formulate
    an optimal processing pipeline.
    """
    meta = metrics["metadata"]
    noise = metrics["noise"]
    complexity = metrics["complexity"]
    sharpness = metrics["sharpness"]
    color = metrics["color"]

    content_type = meta["content_type"]
    noise_score = noise["noise_score"]
    complexity_score = complexity["complexity_score"]
    entropy = complexity["entropy_bits"]
    is_flat_graphic = "Graphic" in content_type or "UI" in content_type

    # 1. Target Format Recommendation
    if is_flat_graphic:
        target_format = "WEBP"
        lossless = True
        recommended_quality = 92
        subsampling = "4:4:4"
        format_rationale_ua = (
            "Виявлено графічний/векторний вміст або UI-інтерфейс. Рекомендовано WebP у режимі збереження різких меж "
            "із субдискретизацією 4:4:4 для запобігання колірному розмиттю тексту."
        )
    else:
        target_format = "WEBP"
        lossless = False
        subsampling = "4:2:0"
        
        # Adaptive Quality based on texture complexity and noise
        if complexity_score > 70:
            # High texture complexity: human visual system (HVS) spatial masking allows moderate compression
            recommended_quality = 80
            format_rationale_ua = (
                "Висока просторова складність (SI) та багата текстура: спрацьовує ефект просторового маскування "
                "зорової системи людини, що дозволяє оптимізувати якість до Q=80 без помітних людині втрат."
            )
        elif complexity_score < 35:
            # Low complexity / smooth gradients: needs higher Q to prevent banding artifacts
            recommended_quality = 88
            format_rationale_ua = (
                "Низька складність і плавні переходи: встановлено підвищену якість Q=88 для запобігання "
                "артефактам ступінчастості (color banding) на градієнтах."
            )
        else:
            recommended_quality = 84
            format_rationale_ua = (
                "Збалансований фотографічний вміст: встановлено оптимальну якість Q=84 із субдискретизацією 4:2:0."
            )

    # 2. Denoising Strategy
    if noise_score > 40.0:
        denoise_filter = "bilateral_strong"
        filter_params = {"diameter": 7, "sigmaColor": 40, "sigmaSpace": 40}
        filter_rationale_ua = (
            f"Критичний рівень високочастотного шуму (коефіцієнт {noise_score}). Активовано білатеральну "
            "фільтрацію із збереженням контурів. Це усуне шум, на який компресор інакше марно витратив би бітрейт."
        )
    elif noise_score > 20.0:
        denoise_filter = "bilateral_mild"
        filter_params = {"diameter": 5, "sigmaColor": 22, "sigmaSpace": 22}
        filter_rationale_ua = (
            f"Помірний шум (коефіцієнт {noise_score}). Застосовано делікатний білатеральний фільтр "
            "для очищення плоских ділянок перед стисненням."
        )
    else:
        denoise_filter = "none"
        filter_params = {}
        filter_rationale_ua = (
            f"Рівень шуму незначний ({noise_score}). Префільтрація не потрібна, вихідні деталі збережено без змін."
        )

    # 3. Color Space Normalization
    strip_metadata = True
    convert_to_srgb = color.get("has_icc", False) and "srgb" not in color.get("profile_name", "").lower()
    color_rationale_ua = (
        "Конвертація в стандартний веб-простір sRGB та видалення надлишкових EXIF метаданих для зменшення ваги."
        if convert_to_srgb else
        "Збереження нормалізованого sRGB простору кольору."
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
        "explanations": {
            "format": format_rationale_ua,
            "filter": filter_rationale_ua,
            "color": color_rationale_ua
        }
    }
