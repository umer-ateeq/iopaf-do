from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


SOURCE = Path("/home/ubuntu/iopaf_v4")
OUTPUT = Path("/home/ubuntu/webdev-static-assets/iopaf-engine")
OUTPUT.mkdir(parents=True, exist_ok=True)


ASSETS = {
    "controls-assessment": (
        SOURCE / "v9_browser_shots/01-controls-focused-workspace.png",
        (115, 320, 1335, 1185),
    ),
    "remediation-ledger": (
        SOURCE / "v9_browser_shots/01-controls-focused-workspace.png",
        (660, 1390, 1320, 2450),
    ),
    "bayesian-summary": (
        SOURCE / "v9_browser_shots/02-risk-summary.png",
        (105, 405, 1350, 1135),
    ),
    "bayesian-network": (
        SOURCE / "v9_browser_shots/03-bayesian-network.png",
        (105, 455, 1335, 1215),
    ),
    "controls-dashboard": (
        SOURCE / "v9_browser_shots/05-controls-dashboard.png",
        (105, 240, 1335, 1180),
    ),
    "control-interdependencies": (
        SOURCE / "v9_browser_shots/06-control-interdependencies.png",
        (110, 365, 1330, 1010),
    ),
    "reports-centre": (
        SOURCE / "visual_pdf_test/reports-download-centre.png",
        (105, 180, 1335, 1050),
    ),
}


for name, (source, box) in ASSETS.items():
    image = Image.open(source).convert("RGB")
    crop = image.crop(box)
    if crop.width > 1500:
        height = round(crop.height * 1500 / crop.width)
        crop = crop.resize((1500, height), Image.Resampling.LANCZOS)
    crop = ImageEnhance.Contrast(crop).enhance(1.035)
    crop = ImageEnhance.Sharpness(crop).enhance(1.08)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=1.1, percent=72, threshold=3))
    destination = OUTPUT / f"{name}.webp"
    crop.save(destination, "WEBP", quality=88, method=6)
    print(f"{destination}\t{crop.width}x{crop.height}\t{destination.stat().st_size}")
