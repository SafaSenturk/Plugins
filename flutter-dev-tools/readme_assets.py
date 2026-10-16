"""usage: python readme_assets.py config.json
config: {raw_dir, out_dir, font_bold, font_regular, title, subtitle, tags[], bg[2 hex], accent,
         banner[3 raw names], shots{out_name: raw_name}, gif?(src path)}
Builds docs/banner.png (three phones on a gradient) and docs/screenshots/*.jpg."""
import json, sys, os, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

c = json.load(open(sys.argv[1], encoding='utf-8'))
out = c['out_dir']; os.makedirs(out + '/screenshots', exist_ok=True)
hexc = lambda h: tuple(int(h.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))

def load(name):
    im = Image.open(os.path.join(c['raw_dir'], name + '.png')).convert('RGB')
    k = c.get('crop', 0)  # trims emulator edge artefacts
    return im.crop((k, k, im.width - k, im.height - k)) if k else im


def phone(name, w):
    im = load(name)
    h = int(w * im.height / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    r = int(w * 0.09); b = int(w * 0.035)
    frame = Image.new('RGBA', (w + 2*b, h + 2*b), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([0, 0, w + 2*b - 1, h + 2*b - 1], radius=r + b, fill=(18, 18, 22, 255))
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w-1, h-1], radius=r, fill=255)
    frame.paste(im, (b, b), mask)
    return frame

W, H = 1600, 900
a, z = hexc(c['bg'][0]), hexc(c['bg'][1])
bg = Image.new('RGB', (W, H))
px = bg.load()
for y in range(H):
    for x in range(W):
        t = (x / W * 0.6 + y / H * 0.4)
        px[x, y] = tuple(int(a[i] + (z[i] - a[i]) * t) for i in range(3))
bg = bg.convert('RGBA')
# soft accent glow
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([W*0.55, -H*0.3, W*1.25, H*0.9], fill=hexc(c['accent']) + (90,))
bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(120)))

d = ImageDraw.Draw(bg)
fb = ImageFont.truetype(c['font_bold'], 92)
fr = ImageFont.truetype(c['font_regular'], 32)
ft = ImageFont.truetype(c['font_bold'], 24)
light = sum(a) / 3 > 140
ink = (20, 20, 26) if light else (250, 248, 244)
soft = (90, 90, 100) if light else (200, 198, 205)
d.text((90, 250), c['title'], font=fb, fill=ink)
y = 375
for line in c['subtitle'].split('\n'):
    d.text((92, y), line, font=fr, fill=soft); y += 46
x, y = 92, y + 30
for tag in c['tags']:
    tw = d.textlength(tag, font=ft)
    d.rounded_rectangle([x, y, x + tw + 36, y + 46], radius=23, fill=hexc(c['accent']) + (255,))
    d.text((x + 18, y + 9), tag, font=ft, fill=(255, 255, 255))
    x += tw + 48
    if x > 640: x, y = 92, y + 58

names = c['banner']
pw = 240
shadow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
positions = [(790, 200), (1055, 115), (1320, 200)]
phones = [phone(n, pw) for n in names]
for (px_, py_), ph in zip(positions, phones):
    s = Image.new('RGBA', ph.size, (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle([0, 0, ph.width-1, ph.height-1], radius=40, fill=(0, 0, 0, 110))
    shadow_layer.paste(s, (px_ + 10, py_ + 30), s)
bg = Image.alpha_composite(bg, shadow_layer.filter(ImageFilter.GaussianBlur(28)))
for (px_, py_), ph in zip(positions, phones):
    bg.paste(ph, (px_, py_), ph)
bg.convert('RGB').save(out + '/banner.png', optimize=True)

for out_name, raw in c['shots'].items():
    im = load(raw)
    im = im.resize((432, int(432 * im.height / im.width)), Image.LANCZOS)
    im.save(f"{out}/screenshots/{out_name}.jpg", quality=88, optimize=True, progressive=True)
if c.get('gif'):
    shutil.copy(c['gif'], out + '/demo.gif')
print('ok', len(c['shots']), 'shots')
