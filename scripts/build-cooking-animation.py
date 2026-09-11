"""Build the in-app cooking animation from a fixed 4x3 sprite sheet."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    sheet = Image.open(args.source).convert("RGBA")
    if sheet.width % 4 or sheet.height % 3:
        raise ValueError("The cooking sprite sheet must be an exact 4x3 grid")

    frame_width = sheet.width // 4
    frame_height = sheet.height // 3
    frames: list[Image.Image] = []
    for row in range(3):
        for column in range(4):
            frame = sheet.crop(
                (
                    column * frame_width,
                    row * frame_height,
                    (column + 1) * frame_width,
                    (row + 1) * frame_height,
                )
            )
            frames.append(frame)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        args.output,
        save_all=True,
        append_images=frames[1:],
        duration=115,
        loop=0,
        lossless=True,
        method=6,
    )


if __name__ == "__main__":
    main()
