"""usage: python make_icon.py <project_dir> <glyph> <bg hex> [fg hex]
Draws a launcher icon with Pillow and writes Android (legacy + adaptive) and
web icons, so no icon-generator package is needed."""
import sys, os
from PIL import Image, ImageDraw

proj, glyph, bg = sys.argv[1:4]
fg = sys.argv[4] if len(sys.argv) > 4 else '#FFFFFF'
S = 2048  # supersampled canvas

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

BG, FG = hexc(bg), hexc(fg)

def draw_glyph(d, cx, cy, u):
    """u = glyph unit (about a quarter of the visible size)."""
    if glyph == 'bag':
        h = 2.5*u
        top = cy - h/2 + 0.45*u
        bot = top + h
        r = 0.35*u
        d.polygon([(cx-1.2*u, top), (cx+1.2*u, top), (cx+1.5*u, bot-r), (cx-1.5*u, bot-r)], fill=FG)
        d.rounded_rectangle([cx-1.5*u, bot-2*r, cx+1.5*u, bot], radius=r, fill=FG)
        t = 0.24*u
        d.arc([cx-0.62*u-t/2, top-1.05*u, cx+0.62*u+t/2, top+0.45*u], 180, 360, fill=FG, width=int(t))
        for x in (cx-0.62*u, cx+0.62*u):
            d.line([x, top-0.3*u, x, top+0.5*u], fill=FG, width=int(t))
        hr = 0.17*u
        for x in (cx-0.62*u, cx+0.62*u):
            d.ellipse([x-hr, top+0.5*u-hr, x+hr, top+0.5*u+hr], fill=BG)
    elif glyph == 'sun':
        import math
        r = 0.95*u
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=FG)
        for i in range(8):
            a = i*math.pi/4
            x1, y1 = cx+math.cos(a)*1.35*u, cy+math.sin(a)*1.35*u
            x2, y2 = cx+math.cos(a)*1.85*u, cy+math.sin(a)*1.85*u
            d.line([x1, y1, x2, y2], fill=FG, width=int(0.3*u))
            for (x, y) in ((x1, y1), (x2, y2)):
                d.ellipse([x-0.15*u, y-0.15*u, x+0.15*u, y+0.15*u], fill=FG)
    elif glyph == 'scan':
        t, L, k = int(0.28*u), 0.75*u, 1.7*u
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = cx+sx*k, cy+sy*k
                d.line([x, y, x-sx*L, y], fill=FG, width=t)
                d.line([x, y, x, y-sy*L], fill=FG, width=t)
                d.ellipse([x-t/2, y-t/2, x+t/2, y+t/2], fill=FG)
        for i, wf in enumerate((1.0, 0.75, 0.9)):
            y = cy - 0.6*u + i*0.6*u
            d.rounded_rectangle([cx-1.0*u, y-0.12*u, cx-1.0*u+2.0*u*wf, y+0.12*u], radius=0.12*u, fill=FG)
    elif glyph == 'chat':
        d.rounded_rectangle([cx-1.7*u, cy-1.4*u, cx+1.7*u, cy+1.0*u], radius=0.7*u, fill=FG)
        d.polygon([(cx-0.9*u, cy+0.8*u), (cx-1.3*u, cy+1.75*u), (cx-0.1*u, cy+0.9*u)], fill=FG)
        for i in (-1, 0, 1):
            r = 0.22*u
            d.ellipse([cx+i*0.85*u-r, cy-0.2*u-r, cx+i*0.85*u+r, cy-0.2*u+r], fill=BG)
    elif glyph == 'calendar':
        d.rounded_rectangle([cx-1.7*u, cy-1.3*u, cx+1.7*u, cy+1.6*u], radius=0.5*u, fill=FG)
        d.rectangle([cx-1.7*u, cy-0.55*u, cx+1.7*u, cy-0.35*u], fill=BG)
        for x in (cx-0.85*u, cx+0.85*u):
            d.rounded_rectangle([x-0.18*u, cy-1.75*u, x+0.18*u, cy-0.9*u], radius=0.18*u, fill=FG)
        t = int(0.3*u)
        d.line([cx-0.65*u, cy+0.55*u, cx-0.15*u, cy+1.0*u], fill=BG, width=t)
        d.line([cx-0.15*u, cy+1.0*u, cx+0.8*u, cy+0.05*u], fill=BG, width=t)
    elif glyph == 'flower':
        import math
        for i in range(5):
            a = i * 2 * math.pi / 5 - math.pi / 2
            px, py = cx + math.cos(a) * 0.95 * u, cy + math.sin(a) * 0.95 * u
            d.ellipse([px - 0.85 * u, py - 0.85 * u, px + 0.85 * u, py + 0.85 * u], fill=FG)
        d.ellipse([cx - 0.55 * u, cy - 0.55 * u, cx + 0.55 * u, cy + 0.55 * u], fill=BG)
    elif glyph == 'leaf':
        d.ellipse([cx-1.6*u, cy-1.6*u, cx+1.6*u, cy+1.6*u], outline=FG, width=int(0.3*u))
        d.pieslice([cx-1.1*u, cy-1.1*u, cx+1.1*u, cy+1.1*u], 200, 340, fill=FG)
    elif glyph == 'globe':
        t = int(0.26*u)
        R = 1.65*u
        d.ellipse([cx-R, cy-R, cx+R, cy+R], outline=FG, width=t)
        d.ellipse([cx-0.75*u, cy-R, cx+0.75*u, cy+R], outline=FG, width=t)
        d.line([cx-R, cy, cx+R, cy], fill=FG, width=t)
        for y in (cy-0.85*u, cy+0.85*u):
            d.line([cx-1.38*u, y, cx+1.38*u, y], fill=FG, width=t)
    else:
        raise SystemExit('unknown glyph ' + glyph)

def render(size, full_bleed, scale):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if full_bleed:
        d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*0.22), fill=BG)
    draw_glyph(d, S/2, S/2, S*scale)
    return img.resize((size, size), Image.LANCZOS)

res = os.path.join(proj, 'android/app/src/main/res')
for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    render(px, True, 0.13).save(f'{res}/mipmap-{name}/ic_launcher.png')
    fg_dir = f'{res}/drawable-{name}'
    os.makedirs(fg_dir, exist_ok=True)
    # Adaptive foreground: 108dp canvas, glyph inside the 66dp safe zone.
    render(int(px*108/48), False, 0.085).save(f'{fg_dir}/ic_launcher_foreground.png')
os.makedirs(f'{res}/mipmap-anydpi-v26', exist_ok=True)
open(f'{res}/mipmap-anydpi-v26/ic_launcher.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
''')
os.makedirs(f'{res}/values', exist_ok=True)
open(f'{res}/values/ic_launcher_colors.xml', 'w').write(f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{bg.upper() if bg.startswith('#') else '#' + bg.upper()}</color>
</resources>
''')
web = os.path.join(proj, 'web')
if os.path.isdir(web):
    render(192, True, 0.13).save(f'{web}/icons/Icon-192.png')
    render(512, True, 0.13).save(f'{web}/icons/Icon-512.png')
    full = Image.new('RGBA', (S, S), BG); d = ImageDraw.Draw(full); draw_glyph(d, S/2, S/2, S*0.08)
    full.resize((192, 192), Image.LANCZOS).save(f'{web}/icons/Icon-maskable-192.png')
    full.resize((512, 512), Image.LANCZOS).save(f'{web}/icons/Icon-maskable-512.png')
    render(32, True, 0.13).save(f'{web}/favicon.png')
render(512, True, 0.13).save(os.path.join(proj, 'icon_preview.png'))
print('icons written')
