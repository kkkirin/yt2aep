// lib.jsx - yt2aep 共通ヘルパ (各ビルドスクリプトから #include)
// 呼び出し元スクリプトで  var __MAIN = File($.fileName);  を #include の前に書くこと
var Y = {};
Y.scriptFile = (typeof __MAIN != "undefined") ? __MAIN : File($.fileName);
Y.logLines = [];
// ログは即時追記(途中で止まっても最後の行から止まった場所が分かる)
Y.log = function (s) {
    Y.logLines.push(String(s));
    try { var f = new File(Y.scriptFile.fsName + ".log"); f.encoding = "UTF-8"; f.open("a"); f.write(String(s) + "\n"); f.close(); } catch (e) {}
};
Y.enableFileWrite = function () {
    try { app.preferences.savePrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY", 1); app.preferences.saveToDisk(); } catch (e) {}
};
Y.writeFile = function (path, text) {
    var f = new File(path); f.encoding = "UTF-8"; f.open("w"); f.write(text); f.close();
};
// run_ae.py が書く <script>.env (key=value 行) を読む。値は前後の空白のみ除去(パスの空白は保持)
Y.readEnv = function () {
    var f = new File(Y.scriptFile.fsName + ".env"); var o = {};
    if (f.exists) {
        f.encoding = "UTF-8"; f.open("r"); var t = f.read(); f.close();
        var ls = t.split("\n");
        for (var i = 0; i < ls.length; i++) {
            var k = ls[i].indexOf("="); if (k <= 0) continue;
            o[ls[i].substring(0, k).replace(/\s/g, "")] = ls[i].substring(k + 1).replace(/^\s+|\s+$/g, "");
        }
    }
    return o;
};
// ---- AE 2024 版(_cc24) ----
// AE 2024 互換が必要なら同じ build を AE 2024 で回し直す。新しい版から旧形式には保存できない
//   保存は app.project.save(Y.aepFile(OUT_DIR, "名前")) … AE 2024 で回した時だけ 名前_cc24.aep
//   env cc24=1 の回は作例 mp4・プレビュー PNG を作らない(本番の版で作り済み。上書きしない)
Y.isCC24 = parseInt(app.version, 10) === 24;
Y.aepFile = function (dir, name) { return new File(dir + "/" + name + (Y.isCC24 ? "_cc24" : "") + ".aep"); };
Y.skipOutputs = function () { if (Y.readEnv().cc24 == "1") { Y.log("skip outputs (cc24)"); return true; } return false; };
Y.finish = function () {
    Y.writeFile(Y.scriptFile.fsName + ".log", Y.logLines.join("\n"));
    var failed = false;
    for (var i = 0; i < Y.logLines.length; i++) if (/^(FATAL|!! ABORT)/.test(Y.logLines[i])) failed = true;
    Y.writeFile(Y.scriptFile.fsName + ".done", failed ? "error" : "ok");
    var env = Y.readEnv();
    if (env.quit == "1") { app.quit(); }
};
// 現在のプロジェクトを保存せずに閉じて新規プロジェクトにする(実行前に中身が自分の作業物だけか確認すること)
Y.freshProject = function () {
    try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e) {}
    app.newProject();
};
// ---- comp / layer helpers ----
Y.comp = function (name, w, h, frames, fps) {
    return app.project.items.addComp(name, w, h, 1, frames / fps, fps);
};
Y.solid = function (comp, name, color, w, h) {
    w = w || comp.width; h = h || comp.height;
    var l = comp.layers.addSolid(color, name, w, h, 1, comp.duration);
    l.name = name; return l;
};
Y.adj = function (comp, name) {
    var l = Y.solid(comp, name, [1, 1, 1]); l.adjustmentLayer = true; return l;
};
Y.fx = function (layer, matchOrName) {
    var fx = null;
    try { fx = layer.property("ADBE Effect Parade").addProperty(matchOrName); } catch (e) {}
    if (!fx) Y.log("!! effect not found: " + matchOrName + " on " + layer.name);
    return fx;
};
// prop: matchName の文字列 or 候補配列。最初に見つかったものを返す
Y.prop = function (fx, names) {
    if (typeof names == "string") names = [names];
    for (var i = 0; i < names.length; i++) { var p = null; try { p = fx.property(names[i]); } catch (e) {} if (p) return p; }
    Y.log("!! prop not found: " + names.join("|") + " in " + (fx ? fx.name : "null"));
    return null;
};
Y.set = function (fx, names, v) { var p = Y.prop(fx, names); if (p) { try { p.setValue(v); } catch (e) { Y.log("!! setValue " + names + "=" + v + " : " + (e && e.message ? e.message : "(err)")); } } return p; };
Y.expr = function (fx, names, ex) { var p = Y.prop(fx, names); if (p) { try { p.expression = ex; } catch (e) { Y.log("!! expr " + names + " : " + (e && e.message ? e.message : "(err)")); } } return p; };
// 調整する式の数値はスライダー制御で外に出す
// 式より先に足す。式からは effect("名前")(1) で読む(日本語/英語 UI どちらでも動く)。戻り値 = エフェクトの番号
Y.slider = function (layer, name, v) {
    var fp = function () { return layer.property("ADBE Effect Parade"); };
    fp().addProperty("ADBE Slider Control");
    var i = fp().numProperties;
    fp().property(i).name = name;
    fp().property(i).property("ADBE Slider Control-0001").setValue(v);
    return i;
};
Y.sl = function (name) { return 'effect("' + name + '")(1)'; };
// keys: [[frame, value], ...]  ease: true で全キー easy ease
Y.keys = function (prop, keys, fps, ease) {
    if (!prop) return;
    for (var i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0] / fps, keys[i][1]);
    if (ease) {
        var e = new KeyframeEase(0, 33.33);
        var t = prop.propertyValueType;
        var dim = (t == PropertyValueType.TwoD || t == PropertyValueType.TwoD_SPATIAL) ? 2 : ((t == PropertyValueType.ThreeD || t == PropertyValueType.ThreeD_SPATIAL) ? 3 : 1);
        var ea = dim == 1 ? [e] : (dim == 2 ? [e, e] : [e, e, e]);
        for (var k = 1; k <= prop.numKeys; k++) { try { prop.setTemporalEaseAtKey(k, ea, ea); } catch (er) {} }
    }
};
Y.preview = function (comp, frame, dir) {
    if (Y.skipOutputs()) return;
    try { var f = new File(dir + "/" + comp.name + "_f" + frame + ".png"); comp.saveFrameToPng(frame / comp.frameRate, f); Y.log("preview " + f.fsName); }
    catch (e) { Y.log("!! preview " + comp.name + ": " + e); }
};
// ---- render ----
// rq.render() は全有効項目を処理するため、既存の出力を巻き込まない。
Y.checkRenderQueue = function (rq) {
    for (var i = 1; i <= rq.numItems; i++) {
        if (rq.item(i).render) throw new Error("Existing enabled render queue items; disable them before running");
    }
};
// comp を書き出す。出力モジュールテンプレートは om.templates から正規表現で選ぶ(日本語UIでも通る)
//   prefer 既定: H.264 → ロスレス。戻り値: 出力ファイルの fsName (H.264 なら .mp4、それ以外 .avi → 呼び出し側で ffmpeg 変換)
Y.renderComp = function (comp, outBase, prefer) {
    if (Y.skipOutputs()) return null;
    prefer = prefer || [/H\.264/i, /ロスレス|Lossless/i];
    var rq = app.project.renderQueue;
    Y.checkRenderQueue(rq);
    var item = rq.items.add(comp);
    var om = item.outputModule(1);
    var tpls = om.templates, chosen = null;
    for (var i = 0; i < prefer.length && !chosen; i++)
        for (var j = 0; j < tpls.length; j++) if (prefer[i].test(tpls[j]) && !/^_HIDDEN/.test(tpls[j])) { chosen = tpls[j]; break; }
    Y.log("OM templates: " + tpls.join(" / "));
    if (!chosen) { Y.log("!! no output template matched"); item.remove(); return null; }
    try { om.applyTemplate(chosen); } catch (e) { Y.log("!! applyTemplate " + chosen + ": " + e); }
    var ext = /H\.264/i.test(chosen) ? ".mp4" : ".avi";
    var f = new File(outBase + ext); if (f.exists) f.remove();
    om.file = f;
    Y.log("render " + comp.name + " with [" + chosen + "] -> " + f.fsName);
    try { rq.render(); } catch (e) { Y.log("!! render: " + e); }
    try { item.remove(); } catch (e) {}
    return f.fsName;
};

// comp の指定フレームを PNG で書き出す(レンダーキューで同期実行。saveFrameToPng と違い同じスクリプト内で確実に描ける)
//   frames: [15, 30, ...]  outDir: 書き出し先フォルダ。ファイル名 = <comp名>_f<frame>.png(AE が末尾に番号を付けるので後で改名)
Y.renderFrames = function (comp, frames, outDir) {
    if (Y.skipOutputs()) return;
    var rq = app.project.renderQueue, items = [];
    Y.checkRenderQueue(rq);
    for (var i = 0; i < frames.length; i++) {
        var it = rq.items.add(comp);
        it.timeSpanStart = frames[i] * comp.frameDuration; it.timeSpanDuration = comp.frameDuration;
        var om = it.outputModule(1), tl = om.templates, pick = null;
        for (var t = 0; t < tl.length; t++) if (/png/i.test(tl[t]) && !/_HIDDEN/.test(tl[t])) { pick = tl[t]; break; }
        if (pick) om.applyTemplate(pick); else Y.log("!! no PNG template");
        om.file = new File(outDir + "/" + comp.name + "_f" + frames[i] + "_[#####].png");
        items.push(it);
    }
    try { rq.render(); } catch (e) { Y.log("!! render " + e); }
    for (var j = 0; j < items.length; j++) { try { items[j].remove(); } catch (e2) {} }
    Y.log("rendered " + comp.name + " " + frames.join(","));
};
