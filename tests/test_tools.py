"""画像ツールを20秒の合成動画で確認する。AE・動画サービスには接続しない。
Run: python -m unittest discover -s tests -v
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class ImageToolsIntegration(unittest.TestCase):
    def test_video_to_sheets_crops_strip_and_comparison(self):
        with tempfile.TemporaryDirectory(prefix="yt2aep-", dir=os.environ.get("TMPDIR")) as tmp:
            work = Path(tmp)
            frames = work / "frames"
            frames.mkdir()
            video = work / "video.mp4"
            self.run_command("ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
                             "-i", "testsrc=size=320x180:rate=10:duration=20",
                             "-c:v", "libx264", "-pix_fmt", "yuv420p", str(video))
            self.run_command("ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
                             "-vf", "fps=1/2", "-q:v", "2", str(frames / "f_%05d.jpg"))
            self.assertEqual(len(list(frames.glob("f_*.jpg"))), 10)
            self.tool("sheets", str(work), "--thresh", "0", "--tile", "160", "--cols", "2", "--rows", "2")
            self.assertEqual(len(list((work / "sheets").glob("sheet_*.jpg"))), 3)
            self.image_size(work / "sheets/sheet_000.jpg", (320, 180))
            self.assertIn("00:18=f_00010.jpg", (work / "sheets/index.txt").read_text())
            self.tool("region", str(work), "--name", "fx", "--region", "10,20,100,80",
                      "--thresh", "0", "--cols", "2", "--rows", "2")
            self.image_size(work / "sheets_fx/sheet_000.jpg", (200, 160))
            self.assertIn("00:18=f_00010.jpg", (work / "sheets_fx/index.txt").read_text())
            self.tool("pick", str(work), "--out", "values.jpg", "--region", "10,20,100,80",
                      "--times", "0,4,18", "--cols", "2")
            self.image_size(work / "picks/values.jpg", (200, 160))
            strip = work / "strip.jpg"
            self.tool("strip", str(video), "--every", "20", "--cols", "2", "--tile", "80", "--out", str(strip))
            self.image_size(strip, (160, 400))
            comparison = work / "comparison.jpg"
            self.tool("compare_sheet", "--out", str(comparison), "--cols", "2", "--tile", "160",
                      "reference=" + str(frames / "f_00001.jpg"),
                      "crop=" + str(frames / "f_00010.jpg") + "@10,20,110,100")
            self.image_size(comparison, (320, 90))

    def tool(self, name, *args):
        self.run_command(sys.executable, str(ROOT / "tools" / (name + ".py")), *args)

    def run_command(self, *args):
        result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=90)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def image_size(self, path, expected):
        with Image.open(path) as im:
            self.assertEqual(im.size, expected)
            im.verify()


if __name__ == "__main__":
    unittest.main()
