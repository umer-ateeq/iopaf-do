from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


SOURCE = Path("/home/ubuntu/iopaf_v4/three_stream_shots")
OUTPUT = Path("/home/ubuntu/webdev-static-assets/iopaf-engine")
OUTPUT.mkdir(parents=True, exist_ok=True)


ASSETS = {
    "standards-lifecycle-mapping": ("standards-mapping.png", (80, 180, 1360, 2780)),
    "journey-three-streams": ("journey-ideation-to-operation.png", (90, 70, 1350, 1870)),
    "sdlc-cmmi-dev-assessment": ("sdlc-cmmi-dev-assessment.png", (0, 55, 1400, 990)),
    "tmmi-testing-assessment": ("tmmi-testing-assessment.png", (0, 55, 1400, 990)),
    "it-operations-assessment": ("it-operations-assessment.png", (0, 55, 1400, 990)),
    "process-results-heatmap": ("process-results-heatmap.png", (75, 55, 1370, 985)),
    "process-results-roadmap": ("process-results-roadmap.png", (75, 55, 1370, 985)),
}


for output_name, (source_name, crop_box) in ASSETS.items():
    source_path = SOURCE / source_name
    image = Image.open(source_path).convert("RGB")
    crop = image.crop(crop_box)
    if crop.width > 1500:
        target_height = round(crop.height * 1500 / crop.width)
        crop = crop.resize((1500, target_height), Image.Resampling.LANCZOS)
    crop = ImageEnhance.Contrast(crop).enhance(1.03)
    crop = ImageEnhance.Sharpness(crop).enhance(1.08)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=1.0, percent=68, threshold=3))
    destination = OUTPUT / f"{output_name}.webp"
    crop.save(destination, "WEBP", quality=88, method=6)
    print(f"{destination}\t{crop.width}x{crop.height}\t{destination.stat().st_size}")
