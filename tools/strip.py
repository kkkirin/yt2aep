"""
strip.py - mp4 を N フレームおきに並べたコンタクトストリップを作る(書き出し結果の目視QA用)
usage: python strip.py <video.mp4> [--every 5] [--cols 6] [--tile 240] [--out path.jpg]
"""
import argparse, subprocess, os, glob, tempfile, shutil
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--every", type=int, default=5)
ap.add_argument("--cols", type=int, default=6); ap.add_argument("--tile", type=int, default=240); ap.add_argument("--out")
a = ap.parse_args()
tmp = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", a.video, "-vf", r"select=not(mod(n\," + str(a.every) + "))", "-fps_mode", "vfr", os.path.join(tmp, "s_%04d.png")], check=True)
fs = sorted(glob.glob(os.path.join(tmp, "s_*.png")))
rows = (len(fs) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (a.tile * a.cols, a.tile * rows), (30, 30, 30)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB"); im.thumbnail((a.tile, a.tile))
    x, y = (i % a.cols) * a.tile, (i // a.cols) * a.tile; sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 40, y + 14], fill=(0, 0, 0)); d.text((x + 3, y + 2), f"f{i * a.every}", fill=(255, 255, 0))
out = a.out or os.path.splitext(a.video)[0] + "_strip.jpg"
sheet.save(out, quality=85); shutil.rmtree(tmp); print(out, len(fs), "frames")
