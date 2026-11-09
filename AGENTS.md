# yt2aep：AI向けの作業手順

このフォルダを作業ルートにする。ユーザーの動画URLを受け取り、動画の構成・数値を読み、**AE内で編集できるAEP**を作る。元映像と作例を並べて直し、推定値・代用・未確認を短く残す。

## 先に確認すること

- 開いているプロジェクト、保存状態、AEの版を確認する。未保存の別作業なら何もしない。別のプロジェクトを保存・閉じる判断はユーザーに任せる。
- `Y.freshProject()` は現プロジェクトを保存せず閉じる。空の新規か、自分の作業物と確認できた場合だけ使う。グリッチ例は出力先のAEPと完全一致する場合だけ再作成を許可するので、残したい変更は別名保存する。
- AEの複数の版へ同時に送らない。両ランナーの `--ae` は2024〜2026。Macはパス指定とping、同梱の実行用JSXは `ae=` と `app.version` の比較で版を確認する。新しく書くJSXにも同じ確認を入れる。
- 公開・送信・アップロードはこの手順に含まない。ライセンスは未定。
- 自分のチャンネル以外の動画はその利用条件を守る。作者が配っている素材・プロジェクトも使い方を確認する。

## 準備

Python 3（3.9以上）、Pillow、ffmpeg、yt-dlp、After Effectsが必要。ffmpegはPATHから呼べる状態にする。

Mac（このフォルダ内で実行）:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install Pillow yt-dlp
```

Windows（PowerShell）:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install Pillow yt-dlp
```

以下の `python` は上で作った仮想環境のPythonに読み替える。実行ポリシーを変更せず、Pythonの実行ファイルを直接呼んでよい。`node` は構文・回帰チェックを行う開発者だけが使う。

AEの環境設定で「スクリプトによるファイルへの書き込みとネットワークアクセスを許可」を有効にする。Macは初回にターミナル等からAEを操作する許可が出たら許可する。

## 動画から作る順番

1. `cache/tutorial/frames/` を作る。動画・字幕・画像は `cache/`、成果物は `output/<名前>/` に分ける。URLはユーザー指定のものだけ使う。
2. メタデータ・動画を取得する。動画と字幕は別コマンドにし、字幕の取得失敗で動画の取得が止まらないようにする。

```sh
python -m yt_dlp --dump-single-json "動画URL" > cache/tutorial/info.json
python -m yt_dlp -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]" -o cache/tutorial/video.mp4 "動画URL"
python -m yt_dlp --skip-download --write-subs --write-auto-subs --sub-langs "ja.*,en.*" -o "cache/tutorial/subtitle.%(ext)s" "動画URL"
```

3. 音声解説がある場合は字幕を先に読む。字幕が無い・取得できない場合はその旨を記録する。テロップ・章と合わせて工程を掴む。
4. 2秒間隔のコマを抽出してシートにする。抽出間隔を変えたら、sheets・region・pickの `--interval` も同じ秒数にする。ファイルは `f_00001.jpg` から連番で揃える。

```sh
ffmpeg -i cache/tutorial/video.mp4 -vf fps=1/2 -q:v 2 cache/tutorial/frames/f_%05d.jpg
python tools/sheets.py cache/tutorial --interval 2 --thresh 5
```

5. シートを見て工程を記録する。エフェクトやタイムラインの数値は領域だけを切り出す。座標はまず実際の1コマを見て決める。下の座標は例で、画面サイズ・レイアウトに合わせて変える。`--region` は **x,y,幅,高さ**。

```sh
python tools/region.py cache/tutorial --name fx --region 0,95,375,605 --interval 2 --thresh 2.5
python tools/region.py cache/tutorial --name tl --region 0,700,1920,225 --interval 2 --cols 1 --rows 5
python tools/pick.py cache/tutorial --out values.jpg --region 0,95,375,605 --times 10,14,18 --interval 2
```

6. `ref/fx_catalog.txt` からmatchNameを検索し、`jsx/build_<名前>.jsx` を書く。カタログは全機能を網羅しない。`NOT AVAILABLE` は取得時の記録で、全環境で使えないという意味ではない。例のコロラマは `APC Colorama`。不足した標準エフェクトは実機で照合する。
7. 下の「JSXの約束」に従ってビルドし、対象の版で実行する。

```sh
# Mac
python tools/run_ae_mac.py jsx/examples/build_glitch.jsx --ae 2026
# Windows
python tools/run_ae.py jsx/examples/build_glitch.jsx --ae 2026
```

例の既定出力は `output/glitch/glitch_text_ai_simple.aep` と `output/glitch/preview/pass1/` のPNG。`--env "out=出力先の絶対パス"` で変更できる（空白込みの値は引数全体を引用符で囲む）。`simple=0` は詳細版、`frames=0` はPNG省略、`mp4=1` は動画も出力、`mogrt=1` はテンプレートも出力。`scale=2` などで文字・ノイズ・光のサイズ比をまとめて変更できる。AE 2024ではAEP名に `_cc24` が付く。互換版が必要な時だけ同じビルドを2024で回し直し、`--env cc24=1` で画像・動画の上書きを避ける。

8. 元の完成コマと同じ時点の作例を並べ、文字、配置、色、光、動きを確認する。`compare_sheet.py` のクロップは **x0,y0,x1,y1**（regionの指定とは異なる）。ラベルは英数字なら既定フォントでも表示できる。

```sh
python tools/compare_sheet.py --out output/compare.jpg --cols 2 "reference=cache/tutorial/frames/f_00006.jpg@0,0,640,360" "build=output/glitch/preview/pass1/対象のPNG.png"
```

一度に大量のコマを読まず、全体シート→変化した領域→不足する秒数の順で見る。値を直して再実行し、比較を残す。読めなかった数値は「推定」、代替効果は「代用」と明記する。

9. 最後にAEPを保存し、作例を書き出す。個別の書き出し・プレビューは次の形。下のパスとコンポ名は実物に置き換える。Macは `run_ae_mac.py`、Windowsは `run_ae.py` を使う。

```sh
python tools/run_ae_mac.py jsx/render_comp.jsx --ae 2026 --env "aep=AEPの絶対パス" "comp=glitch text" "out=出力先の絶対パス・拡張子なし"
python tools/run_ae_mac.py jsx/preview_comps.jsx --ae 2026 --env "comps=glitch text:12,glitch text:40" "out=既存フォルダの絶対パス"
python tools/strip.py output/example.mp4 --every 4 --cols 5 --out output/main_strip.jpg
```

動画書き出しはH.264テンプレートを優先し、無い場合はロスレスへフォールバックする。実際の出力形式・拡張子をログで確認する。`output/` 等、渡す出力先の親フォルダは先に作る。AEPの編集内容を動画側だけで差し替えない。

## JSXの約束

- ExtendScriptはES3。`var` を使い、AEコレクションは1始まり。最初に `var __MAIN = File($.fileName);`、続いて `#include "lib.jsx"`。`examples/` 内からは `#include "../lib.jsx"`。
- 日本語を含むJSXは **UTF-8 BOM付き**で保存する。特に日本語レイヤー・エフェクト名を使う式は、BOMが無いとDoScriptFileで文字化けすることがある。例はBOMとCRLFを保持する。
- エフェクト・プロパティは英語の表示名ではなく **matchName** またはインデックスで指定する。日本語UIでも同じコードを使う。
- 式で調整する数値は、ヌル「コントロール」の少数のスライダーへ出す。先に `Y.slider()` で作り、式では `effect("名前")(1)` で読む。例は「グリッチの強さ」「光の強さ」「イン・アウトの速さ」の3本（50が基準）。内部定数まで大量に並べない。
- 全体をtry/catch/finallyで包み、開始時に `app.beginSuppressDialogs()`、finallyで `app.endSuppressDialogs(false)` と `Y.finish()`。例の版確認・安全確認を流用する。エラーは `Y.log("FATAL " + エラー)`、安全中断は `Y.log("!! ABORT: 理由")`。ランナーは `.done` の `error` を失敗として返す。正常終了でもログ中の `!!` と実物を確認する。
- ランナーはJSX横に `.env`・`.log`・`.done` を作る。`--ae` を `ae=` として自動で渡す。Macのロックとpingは道具フォルダ内の `.runtime/`。コピーした別フォルダとの排他は無いので、AEを同時操作しない。タイムアウトしてもAE内の処理は続く可能性があるため、状態・ログ・ダイアログを確認してから再実行する。

## 共通のハマりどころ

- ドロップダウン番号は**区切り線も数える**。フラクタルノイズ等の種類・描画モードが違う場合はまず番号を確認する。
- コロラマの出力サイクル、トーンカーブの曲線はスクリプトで直接設定できない。プリセット＋レベル、カラーバランス等で代用し、名前に代用と明記する。
- AE 2026はグロー追加直後のグローカラーがA&Bの場合がある。元のカラーなら `ADBE Glo2-0007 = 1` を明示する。グローのしきい値は0〜255、レベルの白入力・極座標の補間は0〜1。
- エフェクトやシェイプグループへ `addProperty()` すると以前の参照が無効になることがある。番号を保持し、追加後に取り直す。
- `saveFrameToPng` は非同期。同じビルド内では黒くなる場合があるので、`preview_comps.jsx` を別実行するか、同期の `Y.renderFrames()` を使う。`Y.renderFrames()` の1コマ幅・開始時刻は `comp.frameDuration` に合わせる（29.97fps対策）。
- MacはDoScriptFileの前にAEを前面化する。2025と2026はbundle idが同じなので、アプリ名だけで送らずパスと応答版を確認する（Macランナーが実施）。
- Macのネイティブ書き出しは `/tmp` では失敗する場合がある。通常は道具フォルダ内の `output/` を使う。
- レンダーキューに既存の有効項目があれば同梱のヘルパーは中断する。対象を確認し、既存項目を無効にしてから実行する。レンダーキューの出力名を重複させない。自分の出力先だけを使い、既存ファイルの置き換えに注意する。
- `.mogrt` は書き出し先に**フォルダ**を渡す。`~` はAPI側で展開されないので `new Folder(パス).fsName` にして渡す。書き出し後にコンポ参照が無効になる場合があるため最後に行う。
- Windowsは `.com -r` だけで簡易起動させず、GUI起動を待つ（Windowsランナーが実施）。止まったらログと画面を確認する。`tools/ae_shot.ps1` と `ae_dialog_print.ps1` は撮影用。すべて `-ProcessId <対象AEのPID>` を必須にしている。`Get-Process AfterFX | Select-Object Id,Path` で対象の版を確かめる。
- `ae_dismiss.ps1 -ProcessId <PID> -Seconds 60` はダイアログへWM_CLOSEを送る。`ae_dialog_click.ps1` は指定位置をクリックし、`ae_dialog_print.ps1 -Enter` はEnterを送る。画面と対象PIDを確認し、自分のビルドが出したダイアログだけに使う。自動では並走させない。

## 完了時に残すもの

AEP、作例、比較画像、短い作業メモ（構成・推定・代用・実行したAEの版・未検証）。`cache/` と個人の環境情報は配布物に混ぜない。公開・送信は別の指示を待つ。

開発時の確認：`python -m py_compile tools/*.py`、`node tests/verify_jsx.cjs`。JSXの構文確認は `#include` 行を外して `node --check` に標準入力で渡す。AE固有APIと見た目は実機で別に確認する。
