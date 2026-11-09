"""
region.py - frames/ の指定領域だけを切り出し、変化があったものだけタイル化
usage: python region.py <cache_dir> --name fx --region 0,95,375,605 [--interval 2] [--thresh 3] [--cols 4] [--rows 2] [--t0 0] [--t1 9999] [--scale 1.0]
  出力: <cache>/sheets_<name>/sheet_XXX.jpg + index.txt
  用途: AEのエフェクトコントロール/タイムラインなど、数値を読みたい領域をフル解像度で束ねる
"""
import os, glob, argparse
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat

ap = argparse.ArgumentParser()
ap.add_argument("cache"); ap.add_argument("--name", required=True)
ap.add_argument("--region", required=True)
ap.add_argument("--interval", type=float, default=2)
ap.add_argument("--thresh", type=float, default=3)
ap.add_argument("--cols", type=int, default=4); ap.add_argument("--rows", type=int, default=2)
ap.add_argument("--t0", type=float, default=0); ap.add_argument("--t1", type=float, default=99999)
ap.add_argument("--scale", type=float, default=1.0)
a = ap.parse_args()
x, y, w, h = map(int, a.region.split(","))
out = os.path.join(a.cache, f"sheets_{a.name}"); os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(os.path.join(a.cache, "frames", "f_*.jpg")))
try: font = ImageFont.truetype("arial.ttf", 20)
except Exception: font = ImageFont.load_default()

kept, prev = [], None
for i, p in enumerate(files):
    t = i * a.interval
    if t < a.t0 or t > a.t1: continue
    c = Image.open(p).crop((x, y, x + w, y + h))
    s = c.convert("L").resize((48, max(1, int(48 * h / w))))
    if prev is not None:
        d = ImageStat.Stat(ImageChops.difference(s, prev)).mean[0]
        if d < a.thresh: continue
    prev = s; kept.append((t, p, c))
print(f"region {a.name}: kept {len(kept)}")
tw, th = int(w * a.scale), int(h * a.scale)
per = a.cols * a.rows; lines = []
for n in range(0, len(kept), per):
    chunk = kept[n:n + per]
    sheet = Image.new("RGB", (tw * a.cols, th * a.rows), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
    names = []
    for k, (t, p, c) in enumerate(chunk):
        if a.scale != 1.0: c = c.resize((tw, th), Image.LANCZOS)
        px, py = (k % a.cols) * tw, (k // a.cols) * th
        sheet.paste(c, (px, py))
        lab = f"{int(t)//60:02d}:{int(t)%60:02d}"
        dr.rectangle([px, py, px + 62, py + 24], fill=(0, 0, 0)); dr.text((px + 3, py + 1), lab, fill=(255, 255, 0), font=font)
        dr.rectangle([px, py, px + tw - 1, py + th - 1], outline=(90, 90, 90))
        names.append(f"{lab}={os.path.basename(p)}")
    sn = f"sheet_{n // per:03d}.jpg"; sheet.save(os.path.join(out, sn), quality=85)
    lines.append(f"{sn}: " + " ".join(names))
open(os.path.join(out, "index.txt"), "w", encoding="utf-8").write("\n".join(lines))
print(f"-> {len(lines)} sheets in {out}")
