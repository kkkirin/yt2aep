"""
run_ae_mac.py - Mac 版 run_ae.py。ExtendScript(.jsx) を AE で実行し <script>.done / <script>.log を待つ
usage: python3 run_ae_mac.py <script.jsx> [--ae 2026] [--timeout 600] [--env k=v ...]
  - 実行経路: osascript で AE を前面化 → DoScriptFile(前面化しないと無言不発)
  - 複数セッションが同じ AE を叩くので 道具フォルダ内の .runtime/ae_<版>.lock (mkdir ロック) を取ってから実行し、終わったら外す
  - saveFrameToPng などネイティブ書き出しは /tmp 配下に書けない(無言失敗)。出力先は道具フォルダの output/ 等にすること
"""
import sys, os, subprocess, time, argparse, json
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("script")
ap.add_argument("--ae", default="2026", choices=[str(y) for y in range(2024, 2027)])
ap.add_argument("--timeout", type=int, default=600)
ap.add_argument("--env", nargs="*", default=[])
ap.add_argument("--owner", default=os.environ.get("AE_LOCK_OWNER", "yt2aep"))
a = ap.parse_args()

APP = f"Adobe After Effects {a.ae}"
# 2025 と 2026 は bundle id が同じ(com.adobe.AfterEffects.application)で、名前指定の tell が別の版に届くことがある。
# パス指定で送り、さらに ping で app.version を確かめてから本番スクリプトを送る
APP_PATH = f"/Applications/{APP}/{APP}.app"
WANT = f"{int(a.ae) - 2000}."
RUNTIME = Path(__file__).resolve().parent.parent / ".runtime"
RUNTIME.mkdir(exist_ok=True)
LOCK = str(RUNTIME / f"ae_{a.ae}.lock")
script = os.path.abspath(os.path.expanduser(a.script))
if not os.path.isfile(script):
    sys.exit("script not found: " + script)
done, log = script + ".done", script + ".log"


def osa(src, timeout=60):
    return subprocess.run(["osascript", "-e", src], capture_output=True, text=True, timeout=timeout)


def ae_running():
    return subprocess.run(["pgrep", "-f", f"{APP}.app/Contents/MacOS"], capture_output=True).returncode == 0


def acquire():
    t0 = time.time()
    while True:
        try:
            os.mkdir(LOCK)
            with open(os.path.join(LOCK, "owner"), "w") as f:
                f.write(f"{a.owner} pid={os.getpid()} {time.strftime('%H:%M:%S')} {os.path.basename(script)}\n")
            return
        except FileExistsError:
            if time.time() - t0 > 1800:
                sys.exit("lock wait timeout: " + open(os.path.join(LOCK, "owner")).read() if os.path.exists(os.path.join(LOCK, "owner")) else "lock wait timeout")
            if int(time.time() - t0) % 60 < 5:
                try: print("waiting AE lock:", open(os.path.join(LOCK, "owner")).read().strip(), flush=True)
                except Exception: pass
            time.sleep(5)


def release():
    try:
        for n in os.listdir(LOCK): os.remove(os.path.join(LOCK, n))
        os.rmdir(LOCK)
    except Exception: pass


def do_script(path, timeout):
    osa(f'tell application "{APP_PATH}" to activate')
    time.sleep(1)
    return osa(f'with timeout of {timeout} seconds\ntell application {json.dumps(APP_PATH, ensure_ascii=False)} to DoScriptFile {json.dumps(path, ensure_ascii=False)}\nend timeout', timeout + 30)


def wait_ready():
    """起動直後は DoScriptFile を受けないので ping jsx が結果を書くまで待つ"""
    ping = str(RUNTIME / f"ping_{a.ae}.jsx"); out = ping + ".txt"
    with open(ping, "w") as f:
        f.write('var f=new File(%s);f.open("w");f.write(app.version);f.close();' % json.dumps(out))
    t0 = time.time()
    while time.time() - t0 < 240:
        if os.path.exists(out): os.remove(out)
        try: do_script(ping, 30)
        except subprocess.TimeoutExpired: pass
        if os.path.exists(out):
            ver = open(out).read().strip()
            if not ver.startswith(WANT):
                sys.exit(f"ping answered by AE {ver}, not {a.ae} -> abort (AppleEvent went to another version)")
            return time.time() - t0
        time.sleep(5)
    sys.exit("AE did not become ready")


acquire()
try:
    for f in (done, log):
        if os.path.exists(f): os.remove(f)
    if not ae_running():
        print("launching", APP, flush=True)
        subprocess.run(["open", "-a", APP_PATH], check=True)
        time.sleep(20)
    print(f"AE ready ({wait_ready():.0f}s)", flush=True)
    with open(script + ".env", "w", encoding="utf-8") as f:
        f.write("quit=0\n")
        f.write(f"ae={a.ae}\n")
        for kv in a.env: f.write(kv + "\n")
    t0 = time.time()
    try:
        r = do_script(script, a.timeout)
        if r.returncode: print("osascript:", r.stderr.strip())
    except subprocess.TimeoutExpired:
        print("osascript timeout (script may still be running)")
    while time.time() - t0 < a.timeout:
        if os.path.exists(done):
            time.sleep(1)
            text = open(log, encoding="utf-8").read() if os.path.exists(log) else "(no log)"
            print(text)
            pngs = [l.split(" ", 1)[1].strip() for l in text.splitlines() if l.startswith("preview ")]
            if pngs:
                t1 = time.time(); last = {}
                while time.time() - t1 < 300:
                    sizes = {q: (os.path.getsize(q) if os.path.exists(q) else -1) for q in pngs}
                    if all(v > 0 for v in sizes.values()) and sizes == last: break
                    last = sizes; time.sleep(2)
                print(f"previews ready: {sum(1 for v in last.values() if v > 0)}/{len(pngs)}")
            print(f"done in {time.time() - t0:.0f}s")
            sys.exit(0 if open(done, encoding="utf-8").read().strip() == "ok" else 1)
        time.sleep(2)
    print("TIMEOUT: log tail ->", open(log, encoding="utf-8").read()[-800:] if os.path.exists(log) else "(no log)")
    sys.exit(1)
finally:
    release()
