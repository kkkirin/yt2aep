# 実装結果

配布準備用の道具・AI向け手順・人向けREADMEを作成した。ライセンスは MIT。

## 変更

- 個人名・ユーザー名、個人フォルダの絶対パス、元動画の作者・タイトル・ID、本人の発言・日付、個別案件や外部の記憶への参照を除去した。原文の個人情報はこの報告にも再掲していない。
- 出力は道具フォルダ内の `output/glitch/` が既定。`--env out=<絶対パス>` で変更できる。Macのロック・pingは `.runtime/`、Windowsの画面取得は `output/` を既定にした。
- グリッチ例のincludeを `../lib.jsx` に修正し、UTF-8 BOMとCRLFを保持。既定は「コントロール」の3本のスライダーで調整する簡易版。詳細版は `simple=0`。
- `Y.renderFrames()` は開始時刻と1コマ幅に `comp.frameDuration` を使う。
- 別フォルダの同名AEP、未保存の別作業を保護する。単体書き出しも、開いている別プロジェクトを切り替えず中断する。
- 既存の有効なレンダーキュー項目があれば、ヘルパーは項目追加・実行前に中断する。
- ランナーは対象版を `ae=` で渡す。同梱の実行用JSXは版を検証し、FATAL・安全中断を失敗マーカーで返す。Macの日本語・空白・引用符を含むパスを保持する。
- Windowsのダイアログ操作・撮影は `-ProcessId` を必須にして、対象版を確認したプロセスだけを操作する。
- ライセンスは MIT（`LICENSE`）。
- グリッチ例の文字とノイズのコンポは既定で3840幅。1920幅だと、文字を大きくしてグリッチを強くした時に、ずれた文字がコンポの端で切れる。`wide=0` で1920幅に戻せる。

## 入れたファイル（25件）

| 場所 | ファイル |
| --- | --- |
| ルート | `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `REPORT.md` |
| tools | `sheets.py`, `region.py`, `pick.py`, `strip.py`, `compare_sheet.py`, `run_ae_mac.py`, `run_ae.py` |
| tools | `ae_dismiss.ps1`, `ae_shot.ps1`, `ae_dialog_print.ps1`, `ae_dialog_click.ps1` |
| jsx | `lib.jsx`, `preview_comps.jsx`, `render_comp.jsx` |
| jsx/examples | `build_glitch.jsx` |
| ref | `fx_catalog.txt` |
| tests | `test_tools.py`, `test_runner.py`, `verify_jsx.cjs` |

## 入れなかったもの

- `BRIEF.md`（作業指示のみ、コミット対象外）。元のREADME・スキルはそのままコピーせず、共通手順だけ新しい文書に移した。
- `cache/`, `projects/`, `e3d_looks/`, `of_research/`, `assets/` と各ディレクトリの内容。
- `jsx/build_*.jsx` のうちグリッチ以外。`_diag*`, `_probe*`, `_test*`, `_patch*`, `_quit*`, `_ping*`, `_close*`, `_dump*`, `_fx_catalog*.jsx`。
- `ref/plugins.txt`、サードパーティのパラメータ一覧、`ref/` のカタログ以外の画像・資料。
- 未使用ツール：`blender_rock_sprites.py`, `run_ae_win.sh`, `ae_dialog_shot.ps1`, `ae_dialog_text.ps1`, `ae_dialogs.ps1`。
- `*.log`, `*.done`, `*.env`, `.env`, `__pycache__/`, `.DS_Store`。
- 検証専用の `.venv/`, `.verification/`、合成動画・抽出画像・比較シート。これらは配布・コミット対象外。

## 検証結果

2026-11-09 JST。Python 3.14.8 / Pillow 12.2.0 / ffmpeg 9.0.2 / Node v24.17.0。

| 確認 | 結果 |
| --- | --- |
| `.venv/bin/python -m py_compile tools/*.py` | 7ファイル PASS |
| `TMPDIR="$PWD/.verification/tmp" .venv/bin/python -m unittest discover -s tests -v` | 2テスト PASS |
| 20秒・320×180・10fpsのffmpeg testsrc | 動画生成、2秒間隔で10コマ抽出 PASS |
| sheets / region / pick / strip / compare_sheet | 全5ツールを実行、画像の復号・寸法・最終時刻を確認 PASS |
| `node tests/verify_jsx.cjs` | 端数fps、既存キュー保護、BOM、ビルド・単体出力時の別作業保護、完了マーカー PASS |
| 全4 JSXからinclude行だけ除去し `node --check` | 全4ファイル PASS。let/const/矢印関数の混入なし |
| グリッチ例のバイト列 | UTF-8 BOM、全改行CRLF PASS |
| Python CLI `--help` | 全7ツール PASS（AEは操作せず） |
| 指定された個人情報語の大文字小文字を無視したスキャン | 配布対象ファイルで0件。作業指示・Git内部・仮想環境・検証用ファイルは対象外 |
| 元の取り出し対象16ファイルのSHA-256 | 取り出し時と最終検証時が一致。元フォルダへの書き込みなし |

回帰チェックは、修正前の端数fps、既存キューの巻き込み、日本語パスのエスケープで失敗することを確認し、修正後に通した。合成動画の一時ファイルはテスト終了時に削除する。外部への書き込みやAE本体操作を伴うテストは実行していない。

## レビューと残る確認

別エージェントによる読み取り専用レビューを実施。指摘された既存レンダーキューの巻き込みを修正し、回帰テストで確認した。ダイアログ監視の自動並走を勧める記述も修正した。

- AE実機の確認は下の「AE実機での確認」を参照。動画・MOGRT出力、フォント置換、OSの初回操作許可は未検証。
- WindowsとPowerShellの実機テストは未実施（この環境にPowerShellなし）。PID指定・パス変更はコードレビューまで。
- Nodeの検査とAE APIを模した回帰チェックは、ExtendScript実機検証の代わりではない。
- 軽微な継続課題：レンダー例外や不足プロパティの一部は `!!` のログだけで完了マーカーが正常になる。ログと実際の出力を確認する。AEPの生成・出力成功と、見た目の一致は別に確認する。
- タイムアウトしてもAE内部の処理は続く場合がある。別コピーとの実行排他は無い。同時実行せず、状態を確認してから再開する。

## AE実機での確認（2026-11-09・Mac・After Effects 2026 26.5）

Gitから取り直した別フォルダで、AGENTS.md の準備（仮想環境・Pillow・yt-dlp）をそのまま行い、`tools/run_ae_mac.py` でグリッチ例を実行した。

| 確認 | 結果 |
| --- | --- |
| 既定（3本のスライダーの簡易版） | AEP保存・13コマのPNG書き出しまで約11秒。式143個、エラー0 |
| 詳細版（`simple=0 frames=0`） | AEP保存まで約5秒。式138個、エラー0 |
| 文字2.8倍・グリッチの強さ100（`scale=2.8 set=glitch:100`） | 既定の3840幅は文字全体（左391〜右1524px）が出る。`wide=0`（1920幅）は右が1359px、左が561pxで切れる。コマを並べて目でも確認 |

## 次の1手

利用するAEの版で、自分の動画から作る流れを1本通す。新しくつまずいた所は NOTES.md に書き足す。
