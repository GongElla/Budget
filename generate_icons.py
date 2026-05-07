#!/usr/bin/env python3
"""Generate WeChat Mini Program tabBar icons."""

from PIL import Image, ImageDraw

SIZE = 81

GRAY = '#999999'
GREEN = '#07c160'
BG = (0, 0, 0, 0)


def new_image():
    return Image.new('RGBA', (SIZE, SIZE), BG)


def draw_list(draw, color):
    # Three horizontal lines
    y_positions = [24, 40, 56]
    for y in y_positions:
        draw.rounded_rectangle([18, y - 3, 63, y + 3], radius=3, fill=color)


def draw_chart(draw, color):
    # Three bars
    bars = [
        (22, 50, 34, 60),   # short
        (36, 36, 48, 60),   # medium
        (50, 22, 62, 60),   # tall
    ]
    for x1, y1, x2, y2 in bars:
        draw.rounded_rectangle([x1, y1, x2, y2], radius=3, fill=color)


def draw_family(draw, color):
    # Three simple person shapes (circle head + rounded rect body)
    # Left person (smaller)
    draw.ellipse([16, 18, 28, 30], fill=color)
    draw.rounded_rectangle([14, 32, 30, 56], radius=6, fill=color)
    # Right person (smaller)
    draw.ellipse([56, 18, 68, 30], fill=color)
    draw.rounded_rectangle([54, 32, 70, 56], radius=6, fill=color)
    # Center person (larger)
    draw.ellipse([34, 14, 50, 30], fill=color)
    draw.rounded_rectangle([30, 32, 54, 62], radius=7, fill=color)


def draw_mine(draw, color):
    # Single person shape
    draw.ellipse([28, 14, 54, 40], fill=color)
    draw.rounded_rectangle([22, 42, 60, 68], radius=8, fill=color)


icons = [
    ('list', draw_list),
    ('chart', draw_chart),
    ('family', draw_family),
    ('mine', draw_mine),
]

for name, draw_func in icons:
    for suffix, color in [('', GRAY), ('-active', GREEN)]:
        img = new_image()
        draw = ImageDraw.Draw(img)
        draw_func(draw, color)
        path = f'images/tabbar/{name}{suffix}.png'
        img.save(path)
        print(f'Generated {path}')

print('Done.')
