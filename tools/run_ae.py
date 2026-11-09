"""
run_ae.py - ExtendScript(.jsx) を After Effects で実行し、完了マーカー(<script>.done)とログ(<script>.log)を待つ
usage: python run_ae.py <script.jsx> [--ae 2026] [--timeout 600] [--quit]
  - スクリプト側は  var __MAIN = File($.fileName);  を #include "lib.jsx" の前に書き、最後に Y.finish() を呼ぶ
  - AE が起動中ならその AE で実行(絶対に quit しない)。未起動なら起動して実行。
  - --quit を付けた場合のみ、run_ae.py が起動した AE を終了時に app.quit() する
  - 効果によってはモーダルダイアログが出て止まるので、ログと対象ダイアログを確認し、必要な時だけ tools/ae_dismiss.ps1 -ProcessId <対象PID> を使う
"""
import sys, os, subprocess, time, argparse

ap = argparse.ArgumentParser()
ap.add_argument("script")
ap.add_argument("--ae", default="2026", choices=[str(y) for y in range(2024, 2027)])
ap.add_argument("--timeout", type=int, default=600)
ap.add_argument("--quit", action="store_true", help="run_ae.py が起動した AE のみ終了時に app.quit()")
ap.add_argument("--env", nargs="*", default=[], help="key=value をスクリプトへ渡す(Y.readEnv())")
a = ap.parse_args()

exe = rf"C:\Program Files\Adobe\Adobe After Effects {a.ae}\Support Files\AfterFX.com"
script = os.path.abspath(os.path.expanduser(a.script))
if not os.path.isfile(script):
    sys.exit("script not found: " + script)
done, log = script + ".done", script + ".log"
for f in (done, log):
    if os.path.exists(f):
        os.remove(f)

# 別の版の AE (別の作業) が開いていることがあるので、--ae の版の AfterFX.exe だけを見る
_VER_FILTER = "Where-Object { $_.Path -like '*After Effects %s*' }" % a.ae

def ae_window_title():
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
                        "(Get-Process AfterFX -ErrorAction SilentlyContinue | %s | Select-Object -First 1).MainWindowTitle" % _VER_FILTER],
                       capture_output=True)
    return r.stdout.decode("utf-8", "ignore").strip()

def ae_running():
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
                        "(Get-Process AfterFX -ErrorAction SilentlyContinue | %s).ProcessName" % _VER_FILTER],
                       capture_output=True)
    return "AfterFX" in r.stdout.decode("utf-8", "ignore")

running = ae_running()
if not running:
    # .com -r だけで起動すると UI 無しの簡易起動になり saveFrameToPng 等が動かないので、先に GUI を完全起動する
    print("launching AE GUI ...")
    subprocess.Popen([exe.replace("AfterFX.com", "AfterFX.exe")])
    t0 = time.time()
    while time.time() - t0 < 180 and not ae_window_title():
        time.sleep(3)
    time.sleep(8)
    print(f"AE window: {ae_window_title()!r} after {time.time()-t0:.0f}s")
quit_after = (not running) and a.quit
with open(script + ".env", "w", encoding="utf-8") as f:
    f.write("quit=%d\n" % (1 if quit_after else 0))
    f.write(f"ae={a.ae}\n")
    for kv in a.env:
        f.write(kv + "\n")
print(f"AE running={running}  quit_after={quit_after}")

subprocess.Popen([exe, "-r", script])
t0 = time.time()
while time.time() - t0 < a.timeout:
    if os.path.exists(done):
        time.sleep(1)
        text = open(log, encoding="utf-8").read() if os.path.exists(log) else "(no log)"
        print(text)
        # saveFrameToPng は非同期: ログの "preview <path>" が全部書き終わる(サイズが安定する)まで待つ
        pngs = [l.split(" ", 1)[1].strip() for l in text.splitlines() if l.startswith("preview ")]
        if pngs:
            t1 = time.time(); last = {}
            while time.time() - t1 < 300:
                sizes = {q: (os.path.getsize(q) if os.path.exists(q) else -1) for q in pngs}
                if all(v > 0 for v in sizes.values()) and sizes == last:
                    break
                last = sizes; time.sleep(2)
            print(f"previews ready: {sum(1 for v in last.values() if v > 0)}/{len(pngs)} ({time.time() - t1:.0f}s)")
        print(f"done in {time.time() - t0:.0f}s")
        sys.exit(0 if open(done, encoding="utf-8").read().strip() == "ok" else 1)
    time.sleep(2)
print("TIMEOUT (AE のダイアログで止まっていないか tools/ae_shot.ps1 で確認)")
sys.exit(1)
