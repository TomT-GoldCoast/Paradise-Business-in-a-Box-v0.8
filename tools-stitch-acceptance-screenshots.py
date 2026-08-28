#!/usr/bin/env python3
"""Assemble four browser viewport captures into exact 1920x1080 QA frames."""

from pathlib import Path
import argparse

from PIL import Image, ImageDraw, ImageFont


VIEWS = [
    ("homepage", "Public homepage"),
    ("dashboard", "Dashboard"),
    ("route", "Route Center"),
    ("weather", "Weather"),
    ("reports", "Reports"),
    ("equipment", "Equipment & Inventory"),
    ("operations", "Operations Workspace"),
]


def stitch(input_dir: Path, output_dir: Path, slug: str) -> Path:
    parts = [Image.open(input_dir / f"paradise-v060-{slug}-1920-part{i}.jpg").convert("RGB") for i in range(4)]
    for part in parts:
        if part.size != (1363, 936):
            raise ValueError(f"Unexpected source frame size for {slug}: {part.size}")

    frame = Image.new("RGB", (1920, 1080), "white")
    frame.paste(parts[0], (0, 0))
    frame.paste(parts[1].crop((806, 0, 1363, 936)), (1363, 0))
    frame.paste(parts[2].crop((0, 792, 1363, 936)), (0, 936))
    frame.paste(parts[3].crop((806, 792, 1363, 936)), (1363, 936))

    output = output_dir / f"{slug}-1920x1080.jpg"
    frame.save(output, quality=94, optimize=True, progressive=True)
    return output


def contact_sheet(frames: list[tuple[Path, str]], output_dir: Path) -> Path:
    card_w, card_h = 640, 395
    sheet = Image.new("RGB", (card_w * 2, card_h * 4), "#edf7ef")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 23)
    except OSError:
        font = ImageFont.load_default()

    for index, (path, label) in enumerate(frames):
        x = (index % 2) * card_w
        y = (index // 2) * card_h
        image = Image.open(path).convert("RGB").resize((608, 342), Image.Resampling.LANCZOS)
        sheet.paste(image, (x + 16, y + 42))
        draw.text((x + 16, y + 10), label, fill="#073d2f", font=font)

    output = output_dir / "visual-acceptance-contact-sheet.jpg"
    sheet.save(output, quality=92, optimize=True, progressive=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    frames = [(stitch(args.input_dir, args.output_dir, slug), label) for slug, label in VIEWS]
    contact_sheet(frames, args.output_dir)


if __name__ == "__main__":
    main()
