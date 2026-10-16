"""usage: python design_compare.py <out_dir> <font_bold> <font_regular> design1,app1 design2,app2 ... [--credit "text"]
Writes <out_dir>/design_vs_flutter.jpg (design row above app row) and
<out_dir>/design_overlay.gif (each design cross-fading into the app screen)."""
import sys
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
credit = ''
if '--credit' in args:
    i = args.index('--credit')
    credit = args[i + 1]
    del args[i:i + 2]
out, fb, fr, *pairs = args
pairs = [p.split(',') for p in pairs]
W, H = 330, 715  # one phone screen in the sheet


def screen(path, w=W, h=H, radius=34):
    im = Image.open(path).convert('RGB').resize((w, h), Image.LANCZOS)
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return im, mask


# ---- static sheet
gap, side, top = 40, 70, 90
sheet = Image.new('RGB', (side * 2 + len(pairs) * W + (len(pairs) - 1) * gap, top + 2 * H + 100 + 70), '#EEF1F4')
d = ImageDraw.Draw(sheet)
big, small = ImageFont.truetype(fb, 34), ImageFont.truetype(fr, 22)
d.text((side, 26), 'Dribbble design', font=big, fill='#080A23')
d.text((side, top + H + 42), 'Flutter app (this repo)', font=big, fill='#0283D3')
for i, (design, app) in enumerate(pairs):
    x = side + i * (W + gap)
    for k, path in enumerate((design, app)):
        im, mask = screen(path)
        y = top + k * (H + 100)
        sheet.paste(im, (x, y), mask)
        ImageDraw.Draw(sheet).rounded_rectangle([x - 1, y - 1, x + W, y + H], radius=34, outline='#D5DAE0', width=2)
if credit:
    d.text((side, sheet.height - 40), credit, font=small, fill='#6B7280')
sheet.save(f'{out}/design_vs_flutter.jpg', quality=86, optimize=True, progressive=True)

# ---- cross-fade gif
w, h = 250, 542
frames = []
pics = [(screen(a, w, h, 26), screen(b, w, h, 26)) for a, b in pairs]
pad = 16
canvas_size = (pad + len(pairs) * (w + pad), h + 2 * pad + 34)
font = ImageFont.truetype(fb, 22)
steps = [0] * 8 + [i / 10 for i in range(1, 10)] + [1] * 8 + [1 - i / 10 for i in range(1, 10)]
for t in steps:
    c = Image.new('RGB', canvas_size, '#EEF1F4')
    cd = ImageDraw.Draw(c)
    for i, ((da, ma), (ap, _)) in enumerate(pics):
        x = pad + i * (w + pad)
        c.paste(Image.blend(da, ap, t), (x, pad), ma)
    label = 'Design' if t < .5 else 'Flutter'
    cd.text((pad, h + pad + 6), f'{label}  ·  {int(round(t * 100))}% app', font=font,
            fill='#080A23' if t < .5 else '#0283D3')
    frames.append(c.convert('P', palette=Image.ADAPTIVE, colors=200))
frames[0].save(f'{out}/design_overlay.gif', save_all=True, append_images=frames[1:],
               duration=[90 if 0 < s < 1 else 160 for s in steps], loop=0, optimize=True)
print('ok')
