"""One-off: resize favicon.ico into Android mipmap launcher PNGs."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICO = ROOT / "favicon.ico"
OUT = ROOT / "android" / "app" / "src" / "main" / "res"

DENSITIES: dict[str, int] = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def main() -> None:
    im = Image.open(ICO)
    if getattr(im, "n_frames", 1) > 1:
        best_idx = 0
        best_area = 0
        for i in range(im.n_frames):
            im.seek(i)
            area = im.size[0] * im.size[1]
            if area > best_area:
                best_area = area
                best_idx = i
        im.seek(best_idx)
    src = im.convert("RGBA")

    for folder, size in DENSITIES.items():
        d = OUT / folder
        d.mkdir(parents=True, exist_ok=True)
        resized = src.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(d / "ic_launcher.png", "PNG")
        resized.save(d / "ic_launcher_round.png", "PNG")
        print(f"wrote {folder} ({size}px)")


if __name__ == "__main__":
    main()
