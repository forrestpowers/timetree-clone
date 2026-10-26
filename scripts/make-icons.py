"""Generate the PWA icons in static/icons. Run: python3 scripts/make-icons.py"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "static" / "icons"
GREEN = (31, 169, 113)
DARK_GREEN = (23, 138, 91)
WHITE = (255, 255, 255)


def draw_logo(size: int, padding: float, rounded: bool) -> Image.Image:
    scale = 4  # draw large, then downsample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=GREEN)
    else:
        d.rectangle([0, 0, s, s], fill=GREEN)

    # Content box (smaller for maskable icons so it survives cropping)
    p = s * padding
    w = s - 2 * p

    def box(x0, y0, x1, y1):
        return [p + x0 * w, p + y0 * w, p + x1 * w, p + y1 * w]

    d.rounded_rectangle(box(0.12, 0.2, 0.88, 0.86), radius=int(w * 0.1), fill=DARK_GREEN)
    d.rounded_rectangle(box(0.12, 0.33, 0.88, 0.86), radius=int(w * 0.1), fill=(46, 196, 135))
    d.rectangle(box(0.12, 0.33, 0.88, 0.42), fill=(46, 196, 135))
    for x in (0.32, 0.68):
        d.rounded_rectangle(box(x - 0.035, 0.12, x + 0.035, 0.28), radius=int(w * 0.035), fill=WHITE)
    d.ellipse(box(0.35, 0.42, 0.65, 0.72), fill=WHITE)
    d.rounded_rectangle(box(0.47, 0.62, 0.53, 0.8), radius=int(w * 0.03), fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    draw_logo(192, 0.08, True).save(OUT / "icon-192.png")
    draw_logo(512, 0.08, True).save(OUT / "icon-512.png")
    draw_logo(512, 0.2, False).save(OUT / "maskable-512.png")
    # iOS adds its own rounded corners and ignores transparency
    draw_logo(180, 0.1, False).convert("RGB").save(OUT / "apple-touch-icon.png")
    draw_logo(64, 0.06, True).save(OUT.parent / "favicon.png")
    print("Icons written to", OUT)


if __name__ == "__main__":
    main()
