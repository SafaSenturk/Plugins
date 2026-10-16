"""usage: python measure.py <design_pt.png> <screenshot.png> name:x0,y0,x1,y1:mode ...
Boxes are in pt. mode 'dark' finds ink pixels (luma < 110), 'light' finds
white text (luma > 225). Prints the ink bounding box (pt) in both images."""
import sys
from PIL import Image

design = Image.open(sys.argv[1]).convert('L')
shot = Image.open(sys.argv[2]).convert('L').resize(design.size, Image.LANCZOS)


def bbox(img, box, mode):
    x0, y0, x1, y1 = (int(v * 3) for v in box)
    crop = img.crop((x0, y0, x1, y1))
    th = (lambda p: 255 if p < 110 else 0) if mode == 'dark' else (lambda p: 255 if p > 225 else 0)
    b = crop.point(th).getbbox()
    if not b:
        return None
    return tuple(round(v, 1) for v in ((b[0] + x0) / 3, (b[1] + y0) / 3, (b[2] + x0) / 3, (b[3] + y0) / 3))


for spec in sys.argv[3:]:
    name, box, mode = spec.split(':')
    box = [float(v) for v in box.split(',')]
    a, b = bbox(design, box, mode), bbox(shot, box, mode)
    fmt = lambda t: 'none' if t is None else f'x {t[0]:6.1f}-{t[2]:6.1f} (w {t[2]-t[0]:5.1f})  y {t[1]:6.1f}-{t[3]:6.1f} (h {t[3]-t[1]:5.1f})'
    print(f'{name:12} design {fmt(a)}\n{"":12} app    {fmt(b)}')
