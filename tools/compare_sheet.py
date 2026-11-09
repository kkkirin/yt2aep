"""compare_sheet.py - PNG/JPG を ラベル付きで N 列のシートに並べる(参考と自分の版の見比べ用)
usage: python compare_sheet.py --out x.jpg --cols 4 --tile 480 "label=path" "label=path@x0,y0,x1,y1" ...
  @以下はクロップ(元画像のピクセル座標)
"""
import argparse
from PIL import Image, ImageDraw, ImageFont
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True); ap.add_argument("--cols", type=int, default=4); ap.add_argument("--tile", type=int, default=480)
ap.add_argument("items", nargs="+")
a = ap.parse_args()
tw = a.tile; th = int(tw * 9 / 16)
try: font = ImageFont.truetype("meiryo.ttc", 18)
except Exception: font = ImageFont.load_default()
rows = (len(a.items) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (tw * a.cols, th * rows), (40, 40, 40)); d = ImageDraw.Draw(sheet)
for i, it in enumerate(a.items):
    lab, path = it.split("=", 1)
    crop = None
    if "@" in path:
        path, c = path.rsplit("@", 1); crop = tuple(int(v) for v in c.split(","))
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    im.thumbnail((tw, th))
    x, y = (i % a.cols) * tw, (i // a.cols) * th
    sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
    d.rectangle([x, y, x + tw - 1, y + th - 1], outline=(90, 90, 90))
    d.rectangle([x, y, x + 8 + 11 * len(lab), y + 24], fill=(0, 0, 0)); d.text((x + 4, y + 2), lab, fill=(255, 255, 0), font=font)
sheet.save(a.out, quality=88)
print(a.out)
