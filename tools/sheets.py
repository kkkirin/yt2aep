"""
sheets.py  -  frames/ -> dedupe -> contact sheets (token-saving skim layer)
usage: python sheets.py <cache_dir> [--interval 2] [--thresh 6] [--cols 4] [--rows 3] [--tile 480]
 - frames/f_%05d.jpg は ffmpeg fps=1/<interval> で抽出済みの前提
 - 直前採用フレームとの差分(32x18 gray 平均絶対差)が thresh 未満なら捨てる
 - 採用フレームを cols x rows のコンタクトシートに並べ、各タイルに秒数を焼く
 - sheets/index.txt に sheet -> [t秒 = frame番号] を書き出す
"""
import sys, os, glob, argparse
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat

ap = argparse.ArgumentParser()
ap.add_argument("cache")
ap.add_argument("--interval", type=float, default=2)
ap.add_argument("--thresh", type=float, default=6)
ap.add_argument("--cols", type=int, default=4)
ap.add_argument("--rows", type=int, default=3)
ap.add_argument("--tile", type=int, default=480)
a = ap.parse_args()

fr_dir = os.path.join(a.cache, "frames")
sh_dir = os.path.join(a.cache, "sheets")
os.makedirs(sh_dir, exist_ok=True)
files = sorted(glob.glob(os.path.join(fr_dir, "f_*.jpg")))

def sig(p):
    return Image.open(p).convert("L").resize((32, 18))

kept, prev = [], None
for i, p in enumerate(files):
    s = sig(p)
    if prev is None:
        kept.append((i, p)); prev = s; continue
    d = ImageStat.Stat(ImageChops.difference(s, prev)).mean[0]
    if d >= a.thresh:
        kept.append((i, p)); prev = s
print(f"frames {len(files)} -> kept {len(kept)}")

tw = a.tile; th = int(tw * 9 / 16)
per = a.cols * a.rows
try:
    font = ImageFont.truetype("arial.ttf", 22)
except Exception:
    font = ImageFont.load_default()

idx_lines = []
for n in range(0, len(kept), per):
    chunk = kept[n:n + per]
    sheet = Image.new("RGB", (tw * a.cols, th * a.rows), (20, 20, 20))
    dr = ImageDraw.Draw(sheet)
    names = []
    for k, (i, p) in enumerate(chunk):
        im = Image.open(p).convert("RGB").resize((tw, th))
        x = (k % a.cols) * tw; y = (k // a.cols) * th
        sheet.paste(im, (x, y))
        t = i * a.interval
        label = f"{int(t)//60:02d}:{int(t)%60:02d}"
        dr.rectangle([x, y, x + 80, y + 28], fill=(0, 0, 0))
        dr.text((x + 4, y + 2), label, fill=(255, 255, 0), font=font)
        names.append(f"{label}={os.path.basename(p)}")
    sn = f"sheet_{n // per:03d}.jpg"
    sheet.save(os.path.join(sh_dir, sn), quality=80)
    idx_lines.append(f"{sn}: " + " ".join(names))
open(os.path.join(sh_dir, "index.txt"), "w", encoding="utf-8").write("\n".join(idx_lines))
print(f"sheets: {len(idx_lines)} -> {sh_dir}")
