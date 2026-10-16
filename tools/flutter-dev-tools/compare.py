"""usage: python compare.py <design_pt.png> <screenshot.png> <out.jpg> [--crop y0 y1]
Scales an emulator screenshot (393x852 dp screen) to the design's pt grid and
writes design | app | 50 % overlay side by side, so spacing differences show up."""
import sys
from PIL import Image, ImageDraw

design = Image.open(sys.argv[1]).convert('RGB')
shot = Image.open(sys.argv[2]).convert('RGB').resize(design.size, Image.LANCZOS)
blend = Image.blend(design, shot, .5)
y0, y1 = 0, design.height
if '--crop' in sys.argv:
    i = sys.argv.index('--crop')
    y0, y1 = int(float(sys.argv[i + 1]) * 3), int(float(sys.argv[i + 2]) * 3)
parts = [im.crop((0, y0, design.width, y1)) for im in (design, shot, blend)]
w = design.width
out = Image.new('RGB', (w * 3 + 40, y1 - y0), 'white')
for k, p in enumerate(parts):
    out.paste(p, (k * (w + 20), 0))
scale = float(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else 1 / 3
out = out.resize((int(out.width * scale), int(out.height * scale)), Image.LANCZOS)
out.save(sys.argv[3], quality=88)
print('saved', sys.argv[3], out.size)
