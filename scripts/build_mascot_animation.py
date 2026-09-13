"""Turn an evenly spaced mascot sprite sheet into a clean animated WebP.

The image generator is asked for a 5x5 sheet.  Fixed cell boundaries keep one
frame from leaking into another, while alpha cleanup and bottom alignment make
the resulting animation stable at mobile UI sizes.
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--columns", type=int, default=5)
    parser.add_argument("--rows", type=int, default=5)
    parser.add_argument("--start-row", type=int, default=0)
    parser.add_argument("--row-count", type=int)
    parser.add_argument("--ping-pong", action="store_true")
    parser.add_argument("--size", type=int, default=176)
    parser.add_argument("--duration", type=int, default=90)
    parser.add_argument("--alpha-cutoff", type=int, default=48)
    parser.add_argument("--skip-frames", default="", help="Comma-separated 1-based frame numbers")
    return parser.parse_args()


def keep_main_subject(alpha: Image.Image) -> Image.Image:
    """Keep the connected bear-and-prop silhouette, dropping matte fragments."""
    alpha = alpha.copy()
    pixels = alpha.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for start_y in range(alpha.height):
        for start_x in range(alpha.width):
            if (start_x, start_y) in visited or pixels[start_x, start_y] == 0:
                continue
            stack = [(start_x, start_y)]
            component: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                if (x, y) in visited or pixels[x, y] == 0:
                    continue
                visited.add((x, y))
                component.append((x, y))
                if x > 0:
                    stack.append((x - 1, y))
                if x + 1 < alpha.width:
                    stack.append((x + 1, y))
                if y > 0:
                    stack.append((x, y - 1))
                if y + 1 < alpha.height:
                    stack.append((x, y + 1))
            components.append(component)
    if not components:
        return alpha
    main_subject = max(components, key=len)
    keep = set(main_subject)
    for x, y in visited:
        if (x, y) not in keep:
            pixels[x, y] = 0
    return alpha


def remove_flat_background(frame: Image.Image) -> Image.Image:
    """Remove a flat or checkerboard generator matte without erasing white clothes.

    Only matte-like pixels connected to a cell edge are removed.  That keeps the
    chef hat, uniform, black eyes and nose intact even when their colors resemble
    a black, white or gray generated background.
    """
    rgba = frame.convert("RGBA")
    if rgba.getchannel("A").getextrema() != (255, 255):
        return rgba

    def quantize(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
        return tuple(round(channel / 8) * 8 for channel in rgb)

    border_samples: list[tuple[int, int, int]] = []
    for x in range(rgba.width):
        border_samples.extend((rgba.getpixel((x, 0))[:3], rgba.getpixel((x, rgba.height - 1))[:3]))
    for y in range(rgba.height):
        border_samples.extend((rgba.getpixel((0, y))[:3], rgba.getpixel((rgba.width - 1, y))[:3]))
    neutral_counts = Counter(
        quantize(sample) for sample in border_samples if max(sample) - min(sample) <= 28
    )
    palette = [color for color, _ in neutral_counts.most_common(6)]
    if not palette:
        return rgba

    def is_matte(x: int, y: int) -> bool:
        red, green, blue, _ = rgba.getpixel((x, y))
        if max(red, green, blue) - min(red, green, blue) > 38:
            return False
        return any(
            (red - pr) ** 2 + (green - pg) ** 2 + (blue - pb) ** 2 <= 46 ** 2
            for pr, pg, pb in palette
        )

    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()
    for x in range(rgba.width):
        queue.extend(((x, 0), (x, rgba.height - 1)))
    for y in range(rgba.height):
        queue.extend(((0, y), (rgba.width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not is_matte(x, y):
            continue
        visited.add((x, y))
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < rgba.width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < rgba.height:
            queue.append((x, y + 1))

    pixels = rgba.load()
    for x, y in visited:
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
    return rgba


def clean_alpha(frame: Image.Image, cutoff: int) -> Image.Image:
    rgba = remove_flat_background(frame)
    alpha = rgba.getchannel("A")
    alpha = alpha.point(lambda value: 0 if value < cutoff else value)
    alpha = alpha.filter(ImageFilter.MedianFilter(3))
    alpha = keep_main_subject(alpha)
    rgba.putalpha(alpha)
    rgba.putdata([
        (red, green, blue, value) if value else (0, 0, 0, 0)
        for red, green, blue, value in rgba.get_flattened_data()
    ])
    return rgba


def extract_frames(
    sheet: Image.Image,
    columns: int,
    rows: int,
    size: int,
    cutoff: int,
    start_row: int,
    row_count: int,
) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for row in range(start_row, start_row + row_count):
        top = round(row * sheet.height / rows)
        bottom = round((row + 1) * sheet.height / rows)
        for column in range(columns):
            left = round(column * sheet.width / columns)
            right = round((column + 1) * sheet.width / columns)
            cell = clean_alpha(sheet.crop((left, top, right, bottom)), cutoff)
            bbox = cell.getchannel("A").getbbox()
            if bbox is None:
                continue
            subject = cell.crop(bbox)
            available = size - 16
            scale = min(available / subject.width, available / subject.height)
            resized = subject.convert("RGBa").resize(
                (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
                Image.Resampling.LANCZOS,
            ).convert("RGBA")
            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            x = (size - resized.width) // 2
            y = size - resized.height - 8
            canvas.alpha_composite(resized, (x, y))
            frames.append(canvas)
    return frames


def main() -> None:
    args = parse_args()
    sheet = Image.open(args.source)
    row_count = args.row_count if args.row_count is not None else args.rows - args.start_row
    if args.start_row < 0 or row_count < 1 or args.start_row + row_count > args.rows:
        raise ValueError("Selected rows must stay inside the sprite sheet")
    frames = extract_frames(
        sheet,
        args.columns,
        args.rows,
        args.size,
        args.alpha_cutoff,
        args.start_row,
        row_count,
    )
    expected = args.columns * row_count
    if len(frames) != expected:
        raise RuntimeError(f"Expected {expected} frames, extracted {len(frames)}")
    skipped = {
        int(value.strip())
        for value in args.skip_frames.split(",")
        if value.strip()
    }
    if any(index < 1 or index > len(frames) for index in skipped):
        raise ValueError("Skipped frame numbers must stay inside the extracted frame range")
    frames = [frame for index, frame in enumerate(frames, start=1) if index not in skipped]
    if not frames:
        raise ValueError("At least one animation frame must remain")
    if args.ping_pong and len(frames) > 2:
        frames = frames + frames[-2:0:-1]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        args.output,
        save_all=True,
        append_images=frames[1:],
        duration=args.duration,
        loop=0,
        lossless=True,
        method=6,
    )
    print(f"wrote {len(frames)} frames to {args.output}")


if __name__ == "__main__":
    main()
