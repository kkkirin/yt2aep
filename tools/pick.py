"""
pick.py - 指定秒のフレームから指定領域を切り出して1枚に並べる(ピンポイント読み取り用)
usage: python pick.py <cache_dir> --out name.jpg --region x,y,w,h --times 306,310,314 [--interval 2] [--cols 4]
"""
import os, argparse
from PIL import Image, ImageDraw, ImageFont
ap = argparse.ArgumentParser()
ap.add_argument("cache"); ap.add_argument("--out", required=True)
ap.add_argument("--region", required=True); ap.add_argument("--times", required=True)
ap.add_argument("--interval", type=float, default=2); ap.add_argument("--cols", type=int, default=4)
a = ap.parse_args()
x, y, w, h = map(int, a.region.split(","))
times = [float(t) for t in a.times.split(",")]
try: font = ImageFont.truetype("arial.ttf", 20)
except Exception: font = ImageFont.load_default()
rows = (len(times) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (w * a.cols, h * rows), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
for k, t in enumerate(times):
    idx = int(round(t / a.interval)) + 1
    p = os.path.join(a.cache, "frames", f"f_{idx:05d}.jpg")
    c = Image.open(p).crop((x, y, x + w, y + h))
    px, py = (k % a.cols) * w, (k // a.cols) * h
    sheet.paste(c, (px, py))
    lab = f"{int(t)//60:02d}:{int(t)%60:02d}"
    dr.rectangle([px, py, px + 62, py + 24], fill=(0, 0, 0)); dr.text((px + 3, py + 1), lab, fill=(255, 255, 0), font=font)
    dr.rectangle([px, py, px + w - 1, py + h - 1], outline=(90, 90, 90))
out = os.path.join(a.cache, "picks", a.out); os.makedirs(os.path.dirname(out), exist_ok=True)
sheet.save(out, quality=85); print(out)
