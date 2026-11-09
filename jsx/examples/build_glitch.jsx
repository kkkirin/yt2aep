// build_glitch.jsx — 標準エフェクトで作るグリッチテキスト（チュートリアル07）
// 出力先: --env out=<フォルダ>。既定は道具フォルダ内の output/glitch/。
// simple=0 で詳細版。既定は3本のスライダーで操作する簡易版。
// コロラマの出力サイクルはグレースケールランプ＋レベルで代用。
// 文字サイズ・黒の点の角度は映像からの推定値。
var __MAIN = File($.fileName);
#include "../lib.jsx"

var OUT_ENV = Y.readEnv();
var OUT_DIR = new Folder(OUT_ENV.out || (__MAIN.parent.parent.parent.fsName + "/output/glitch")).fsName;
var FPS = 29.97, DURF = 90;              // 元の回: プリセット 1080 29.97 / 3秒
var TEXT = "グリッチテキスト";
var TEXT_SIZE = 57;                       // 推定(1回目 51px で文字幅 365px / 元 405px → 57px に直した)
var FONTS = ["SourceHanSansJP-Heavy", "SourceHanSans-Heavy", "NotoSansCJKjp-Black", "NotoSansJP-Black"];
var CYCLE_BLACK_DEG = 130;                // 推定(21:40 の色の輪の黒い矢印)
var TRI_MID = [227 / 255, 0, 246 / 255, 1];   // 21:00 のスウォッチの色を画素で読んだ値
var TRI_SH = [15 / 255, 164 / 255, 249 / 255, 1];
var REF_FRAMES = [2, 10, 16, 24, 32, 38, 46, 52, 60, 66, 72, 78, 84];
var T0 = new Date().getTime();
function stamp(s) { Y.log(((new Date().getTime() - T0) / 1000).toFixed(1) + "s " + s); }

// ---- effect helpers(AE 2025 は効果の参照がすぐ無効になる→毎回取り直す) ----
function FP(l) { return l.property("ADBE Effect Parade"); }
function addFx(l, match, name) {
    var fx = Y.fx(l, match); if (!fx) return 0;
    var i = FP(l).numProperties;
    if (name) { try { FP(l).property(i).name = name; } catch (e) { Y.log("!! rename " + name + " " + e); } }
    return i;
}
function F(l, i) { return FP(l).property(i); }
function S(l, i, mn, v) { return Y.set(F(l, i), mn, v); }
function E(l, i, mn, ex) { return Y.expr(F(l, i), mn, ex); }
function dump(g, depth, out) {
    for (var i = 1; i <= g.numProperties; i++) {
        var p = g.property(i), v = "-";
        try { if (p.propertyType == PropertyType.PROPERTY && p.propertyValueType != PropertyValueType.NO_VALUE && p.propertyValueType != PropertyValueType.CUSTOM_VALUE) v = String(p.value); } catch (e) { v = "?"; }
        out.push(new Array(depth + 1).join("  ") + p.matchName + " | " + p.name + " | type=" + (p.propertyValueType || "grp") + " = " + v);
        if (p.numProperties && depth < 3) dump(p, depth + 1, out);
    }
}
function findIn(g, test) {
    for (var i = 1; i <= g.numProperties; i++) {
        var p = g.property(i);
        if (test(p)) return p;
        if (p.numProperties) { var r = findIn(p, test); if (r) return r; }
    }
    return null;
}

// ---- 安全確認: 出力先と完全一致する自分のプロジェクト、または空の新規だけ ----
function renderFramesF(comp, frames, outDir) { Y.renderFrames(comp, frames, outDir); }
function ensureFolder(folder) {
    if (folder.exists) return;
    if (!folder.parent.exists) ensureFolder(folder.parent);
    if (!folder.create()) throw new Error("Cannot create output folder: " + folder.fsName);
}
function safeToReplace() {
    var p = app.project;
    if (!p) return true;
    var f = p.file ? p.file.fsName : "";
    Y.log("open project: " + (f || "(untitled)") + " items=" + p.numItems + " dirty=" + p.dirty);
    if (f) {
        return f == new File(OUT_DIR + "/glitch_text_ai.aep").fsName ||
               f == new File(OUT_DIR + "/glitch_text_ai_simple.aep").fsName ||
               f == new File(OUT_DIR + "/glitch_text_ai_cc24.aep").fsName ||
               f == new File(OUT_DIR + "/glitch_text_ai_simple_cc24.aep").fsName;
    }
    return p.numItems == 0 && !p.dirty;

}

function build() {
    var env = Y.readEnv();
    var PASS = env.pass || "1";
    var SIMPLE = env.simple != "0";
    // scale=k: 文字を大きくし、関連する効果のサイズも比率を保って変える。
    //   文字と一緒に、ずらしの量・ノイズの大きさ・ブラー・グローの半径も k 倍にして、見た目の比率を変えない
    var K = env.scale ? parseFloat(env.scale) : 1;
    if (K != 1) Y.log("scale K = " + K);
    app.beginSuppressDialogs();
    Y.enableFileWrite();
    Y.freshProject();
    stamp("fresh project (pass " + PASS + ")");
    app.project.bitsPerChannel = 16;                                        // 元の回: 32→16bpc に戻した(26:37)
    try { app.project.gpuAccelType = GpuAccelType.SOFTWARE; Y.log("renderer: software"); } catch (e) { Y.log("!! gpuAccelType " + e); }   // 24:06 マーキュリーソフトウェア処理
    ensureFolder(new Folder(OUT_DIR)); ensureFolder(new Folder(OUT_DIR + "/preview"));
    var PREV_DIR = OUT_DIR + "/preview/pass" + PASS; new Folder(PREV_DIR).create();

    // ============ text comp ============
    var cText = Y.comp("text", 1920, 1080, DURF, FPS);
    var tl = cText.layers.addText(TEXT);
    var tp = tl.property("ADBE Text Properties").property("ADBE Text Document");
    var got = "";
    for (var k = 0; k < FONTS.length; k++) {
        var td = tp.value;
        td.resetCharStyle(); td.resetParagraphStyle();
        td.fontSize = TEXT_SIZE * K; td.applyFill = true; td.fillColor = [1, 1, 1]; td.applyStroke = false; td.tracking = 0;
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        td.font = FONTS[k];
        tp.setValue(td);
        got = tp.value.font;
        if (got == FONTS[k]) break;
    }
    Y.log("font: " + got);
    var r = tl.sourceRectAtTime(0, false);
    tl.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
    tl.property("ADBE Transform Group").property("ADBE Position").setValue([960, 540]);
    Y.log("text rect w=" + r.width.toFixed(1) + " h=" + r.height.toFixed(1));
    stamp("text comp");

    // ============ noise comp ============
    var cNoise = Y.comp("noise", 1920, 1080, DURF, FPS);
    var n1 = Y.solid(cNoise, "noise", [0, 0, 0]);
    var i = addFx(n1, "ADBE Fractal Noise");
    S(n1, i, "ADBE Fractal Noise-0001", 1);        // 基本
    S(n1, i, "ADBE Fractal Noise-0002", 1);        // ブロック
    S(n1, i, "ADBE Fractal Noise-0004", 500);      // コントラスト
    S(n1, i, "ADBE Fractal Noise-0009", 0);        // 縦横比を固定 off
    S(n1, i, "ADBE Fractal Noise-0011", 300 * K);  // スケールの幅
    S(n1, i, "ADBE Fractal Noise-0012", 50 * K);   // スケールの高さ
    S(n1, i, "ADBE Fractal Noise-0015", 10);       // 複雑度
    Y.keys(Y.prop(F(n1, i), "ADBE Fractal Noise-0005"), [[0, -350], [20, 350], [70, 350], [89, -350]], FPS, false);   // 明るさ
    i = addFx(n1, "ADBE Box Blur2");
    S(n1, i, "ADBE Box Blur2-0001", 2 * K);            // ブラーの半径(画面 28:00 は 2.0)
    S(n1, i, "ADBE Box Blur2-0002", 3);
    function fine(f0, f1) {
        var l = Y.solid(cNoise, "noise", [0, 0, 0]);
        if (!SIMPLE) {
            Y.slider(l, "展開の速さ（度/秒）", 1500);
            Y.slider(l, "コマ落としの揺れ（回/秒）", 10);
            Y.slider(l, "コマ落としの幅（fps）", 10);
        }
        var j = addFx(l, "ADBE Fractal Noise");
        S(l, j, "ADBE Fractal Noise-0001", 1);
        S(l, j, "ADBE Fractal Noise-0002", 1);
        S(l, j, "ADBE Fractal Noise-0004", 170);
        S(l, j, "ADBE Fractal Noise-0005", 120);
        S(l, j, "ADBE Fractal Noise-0009", 0);
        S(l, j, "ADBE Fractal Noise-0011", 25 * K);
        S(l, j, "ADBE Fractal Noise-0012", 6 * K);
        S(l, j, "ADBE Fractal Noise-0015", 1);
        E(l, j, "ADBE Fractal Noise-0023", SIMPLE ? "time * 1500" : "time * " + Y.sl("展開の速さ（度/秒）"));
        var q = addFx(l, "ADBE Posterize Time");
        S(l, q, "ADBE Posterize Time-0001", 12);
        E(l, q, "ADBE Posterize Time-0001", SIMPLE ? "wiggle(10, 10)" : "wiggle(" + Y.sl("コマ落としの揺れ（回/秒）") + ", " + Y.sl("コマ落としの幅（fps）") + ")");
        l.inPoint = f0 / FPS; l.outPoint = f1 / FPS;
        return l;
    }
    fine(30, 47);      // 1秒から(30:34)。字幕は「15フレーム」だが、元の回の 1s16f のコマにも細かいノイズが出ている → 1s16f まで出す(3回目で直した)
    fine(55, 70);      // 1秒25フレーム〜2秒10フレーム(31:25)
    stamp("noise comp");

    // ============ main comp ============
    var cMain = Y.comp("glitch text", 1920, 1080, DURF, FPS);
    cMain.bgColor = [0, 0, 0];
    var lText = cMain.layers.add(cText);
    var lNoise = cMain.layers.add(cNoise); lNoise.enabled = false;
    var lAdj = Y.adj(cMain, "グロー"); lAdj.blendingMode = BlendingMode.ADD;
    var lCtl = null;
    if (SIMPLE) {
        // ヌルの3本だけで調整する。どれも 50 が基準値
        lCtl = cMain.layers.addNull(); lCtl.name = "コントロール";
        Y.slider(lCtl, "グリッチの強さ", 50);
        Y.slider(lCtl, "光の強さ", 50);
        Y.slider(lCtl, "イン・アウトの速さ", 50);
        // set=glitch:70,glow:75 … スライダーの最初の値を変える(派手な作例用)
        if (env.set) { var SM = { glitch: 1, glow: 2, speed: 3 }, ps = env.set.split(",");
            for (var pi = 0; pi < ps.length; pi++) { var kv = ps[pi].split(":"); F(lCtl, SM[kv[0]]).property("ADBE Slider Control-0001").setValue(parseFloat(kv[1])); Y.log("set " + kv[0] + "=" + kv[1]); } }
        // イン・アウトの速さ: ノイズの明るさのキー(0f→2番目のキー＝入り、3番目のキー→最後＝抜け)を、速さの分だけ詰めて読む。キーは残すので手で直せる
        E(n1, 1, "ADBE Fractal Noise-0005",
          'var s = Math.max(comp("glitch text").layer("コントロール").effect("イン・アウトの速さ")(1), 5) / 50;\n' +
          'var fd = thisComp.frameDuration, end = thisComp.duration - fd;\n' +
          'var inEnd = key(2).time, outStart = key(3).time, outLen = end - outStart;\n' +
          'if (time < inEnd / s) valueAtTime(time * s);\n' +
          'else if (time > end - outLen / s) valueAtTime(outStart + (time - (end - outLen / s)) * s);\n' +
          'else valueAtTime(inEnd);');
    }
    var NI = lNoise.index;
    var ln = []; for (var li = 1; li <= cMain.numLayers; li++) ln.push(cMain.layer(li).name);
    Y.log("layers: " + ln.join(" / ") + "  noise index=" + NI);

    // --- text layer: コロラマ → (レベル=代用) → トライトーン → マット設定 → master → DM 2..20 → トランスフォーム
    i = addFx(lText, "APC Colorama");
    var cdump = []; dump(F(lText, i), 0, cdump); Y.writeFile(OUT_DIR + "/preview/colorama_params.txt", cdump.join("\n"));
    S(lText, i, "APC Colorama-0010", 8);                                    // プリセットパレット: グレースケールランプ
    var addLayer = findIn(F(lText, i), function (p) { return p.propertyValueType == PropertyValueType.LAYER_INDEX; });
    if (addLayer) { try { addLayer.setValue(NI); Y.log("colorama add-phase layer: " + addLayer.matchName); } catch (e) { Y.log("!! colorama layer " + e); } } else Y.log("!! colorama layer param not found");
    S(lText, i, "APC Colorama-0018", 0);                                    // アルファを変更 off(21:50)
    var emp = findIn(F(lText, i), function (p) { return p.matchName == "APC Colorama-0019"; });
    if (emp) { try { emp.setValue(0); Y.log("colorama 0019 = 0 (" + emp.name + ")"); } catch (e) { Y.log("!! 0019 " + e); } }
    i = addFx(lText, "ADBE Pro Levels2", "レベル（出力サイクルの代用）");
    var LV = env.lv ? parseFloat(env.lv) : CYCLE_BLACK_DEG / 360;
    S(lText, i, "ADBE Pro Levels2-0004", LV); Y.log("levels black = " + LV);
    i = addFx(lText, "ADBE Tritone");
    S(lText, i, "ADBE Tritone-0001", [1, 1, 1, 1]);
    S(lText, i, "ADBE Tritone-0002", TRI_MID);
    S(lText, i, "ADBE Tritone-0003", TRI_SH);
    i = addFx(lText, "ADBE Set Matte3");
    S(lText, i, "ADBE Set Matte3-0001", NI);
    S(lText, i, "ADBE Set Matte3-0002", 7);                                 // 明度
    var iM = addFx(lText, "ADBE Displacement Map", "master");
    S(lText, iM, "ADBE Displacement Map-0001", NI);
    S(lText, iM, "ADBE Displacement Map-0002", 7);                          // 水平: 明度
    S(lText, iM, "ADBE Displacement Map-0004", 7);                          // 垂直: 明度
    S(lText, iM, "ADBE Displacement Map-0005", 0);
    S(lText, iM, "ADBE Displacement Map-0006", 1);                          // 中央マップ
    S(lText, iM, "ADBE Displacement Map-0007", 0);                          // ピクセルをラップ off
    S(lText, iM, "ADBE Displacement Map-0008", 1);                          // 出力を拡張 on
    var mh = Y.prop(F(lText, iM), "ADBE Displacement Map-0003");
    Y.keys(mh, [[25, -5 * K], [55, 5 * K]], FPS, false);                            // 25f → 1秒25f で -5 → 5(33:14)
    try { for (var kk = 1; kk <= mh.numKeys; kk++) mh.setInterpolationTypeAtKey(kk, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); } catch (e) { Y.log("!! hold " + e); }
    if (SIMPLE) E(lText, iM, "ADBE Displacement Map-0003", 'value * thisComp.layer("コントロール").effect("グリッチの強さ")(1) / 50');   // 50 で元の -5/5
    for (var c = 2; c <= 20; c++) {
        var di = addFx(lText, "ADBE Displacement Map");
        S(lText, di, "ADBE Displacement Map-0001", NI);
        for (var pn = 2; pn <= 8; pn++) E(lText, di, "ADBE Displacement Map-000" + pn, 'effect("master")(' + pn + ')');   // プロパティリンクと一緒にコピー
    }
    if (!SIMPLE) Y.slider(lText, "ずらしの数（枚）", 20);
    i = addFx(lText, "ADBE Geometry2");
    E(lText, i, "ADBE Geometry2-0002", SIMPLE ? '[value[0] + effect("master")(3) * 20, value[1]]' : '[value[0] + effect("master")(3) * ' + Y.sl("ずらしの数（枚）") + ', value[1]]');
    stamp("text layer fx: " + FP(lText).numProperties);

    // --- adjustment: チャンネル設定 → 単色合成 → グロー x3
    i = addFx(lAdj, "ADBE Set Channels");
    S(lAdj, i, "ADBE Set Channels-0008", 8);                                // ソース4のアルファ = 彩度
    i = addFx(lAdj, "ADBE Solid Composite");
    S(lAdj, i, "ADBE Solid Composite-0002", [0, 0, 0, 1]);
    var GL = [[28.6, 14, 1.4], [26.3, 67, 0.1], [2.7, 164, 0.5]];           // 16bpc にした後の値(27:06・26:46)
    for (var g = 0; g < GL.length; g++) {
        i = addFx(lAdj, "ADBE Glo2");
        S(lAdj, i, "ADBE Glo2-0001", 2);                                    // カラーチャンネル
        S(lAdj, i, "ADBE Glo2-0002", GL[g][0] / 100 * 255);
        S(lAdj, i, "ADBE Glo2-0003", GL[g][1] * K);
        S(lAdj, i, "ADBE Glo2-0004", GL[g][2]);
        S(lAdj, i, "ADBE Glo2-0007", 1);                                    // グローカラー: 元のカラー(AE 2026 は足した直後が 2=A&B で、光のもやが消えた)
        if (SIMPLE) E(lAdj, i, "ADBE Glo2-0004", 'value * thisComp.layer("コントロール").effect("光の強さ")(1) / 50');   // 50 で元の強さ
    }
    stamp("adjustment fx");

    // --- エッセンシャルグラフィックス / レスポンシブデザイン(34:27〜36:50)
    try { cMain.motionGraphicsTemplateName = SIMPLE ? "glitch text simple" : "glitch text"; } catch (e) { Y.log("!! mgt name " + e); }
    function egp(prop, name) {
        try { var ok = prop.addToMotionGraphicsTemplateAs(cMain, name); Y.log("EGP " + name + ": " + ok); } catch (e) { Y.log("!! EGP " + name + ": " + e); }
    }
    var tri = null; for (var t = 1; t <= FP(lText).numProperties; t++) if (F(lText, t).matchName == "ADBE Tritone") tri = t;
    if (SIMPLE) {
        egp(F(lCtl, 1).property("ADBE Slider Control-0001"), "グリッチの強さ");
        egp(F(lCtl, 2).property("ADBE Slider Control-0001"), "光の強さ");
        egp(F(lCtl, 3).property("ADBE Slider Control-0001"), "イン・アウトの速さ");
        egp(tl.property("ADBE Text Properties").property("ADBE Text Document"), "テキスト");
    } else {
        egp(Y.prop(F(lText, tri), "ADBE Tritone-0002"), "ミッドトーン");
        egp(Y.prop(F(lText, tri), "ADBE Tritone-0003"), "シャドウ");
        egp(tl.property("ADBE Text Properties").property("ADBE Text Document"), "テキスト");
    }
    try {
        var mk = cMain.markerProperty;
        var a = new MarkerValue("intro"); a.duration = 20 / FPS; a.protectedRegion = true; mk.setValueAtTime(0, a);
        var b = new MarkerValue("outro"); b.duration = (DURF - 70) / FPS; b.protectedRegion = true; mk.setValueAtTime(70 / FPS, b);
        Y.log("protected markers: " + mk.numKeys);
    } catch (e) { Y.log("!! markers " + e); }

    // --- 式のエラーを全部読む(.value は読まない)
    var bad = 0, nexp = 0;
    function scan(g, where) {
        for (var s = 1; s <= g.numProperties; s++) {
            var p = g.property(s);
            if (p.propertyType == PropertyType.PROPERTY) { if (p.expressionEnabled && p.expression != "") { nexp++; if (p.expressionError != "") { bad++; Y.log("!! expr error " + where + " / " + p.name + ": " + p.expressionError); } } }
            else scan(p, where);
        }
    }
    var comps = [cText, cNoise, cMain];
    for (var cc = 0; cc < comps.length; cc++) for (var ll = 1; ll <= comps[cc].numLayers; ll++) scan(comps[cc].layer(ll), comps[cc].name + "/" + comps[cc].layer(ll).name);
    Y.log("expressions: " + nexp + "  errors: " + bad);

    var aep = Y.aepFile(OUT_DIR, env.name ? env.name : (SIMPLE ? "glitch_text_ai_simple" : "glitch_text_ai"));
    app.project.save(aep);
    stamp("saved " + aep.fsName);
    if (env.frames != "0") { renderFramesF(cMain, REF_FRAMES, PREV_DIR); stamp("frames rendered"); }
    if (env.noiseframes == "1") { renderFramesF(cNoise, REF_FRAMES, PREV_DIR); stamp("noise frames rendered"); }
    if (env.mp4 == "1") { var mp4 = Y.renderComp(cMain, PREV_DIR + "/glitch_text_ai_main"); stamp("mp4 " + mp4); }
    // sweeps=glitch:0,50,100;glow:0,50,100;speed:25,50,100 … スライダー1本ずつ値を変えてコマ(と mp4)を書き出す(simple のみ)。ほかの2本は 50。最後は全部 50 に戻して保存
    if (SIMPLE && (env.sweeps || env.sweep)) {
        var SL = { glitch: 1, glow: 2, speed: 3 };
        var SPEED_FRAMES = [3, 6, 9, 12, 15, 20, 72, 76, 80, 84];
        var specs = env.sweeps ? env.sweeps.split(";") : ["glitch:" + env.sweep];
        for (var sp = 0; sp < specs.length; sp++) {
            var key = specs[sp].split(":")[0], vals = specs[sp].split(":")[1].split(",");
            for (var si = 0; si < vals.length; si++) {
                for (var z = 1; z <= 3; z++) F(lCtl, z).property("ADBE Slider Control-0001").setValue(50);
                F(lCtl, SL[key]).property("ADBE Slider Control-0001").setValue(parseFloat(vals[si]));
                var d = PREV_DIR + "/" + key + "_" + vals[si]; new Folder(d).create();
                renderFramesF(cMain, key == "speed" ? SPEED_FRAMES : REF_FRAMES, d);
                if (env.mp4 == "1") Y.renderComp(cMain, PREV_DIR + "/glitch_" + key + "_" + vals[si]);
                stamp("sweep " + key + " " + vals[si]);
            }
        }
        for (var z2 = 1; z2 <= 3; z2++) F(lCtl, z2).property("ADBE Slider Control-0001").setValue(50);
    }
    // 書き出し先はフォルダを渡す(「<テンプレート名>.mogrt」が中にできる)。~ は展開されないので fsName で渡す(3回目で実測)
    // mogrt の書き出しの後は cMain の参照が無効になる(3回目で実測: rq.items.add が「CompItem の種類が不正確」) → 書き出しは最後
    if (env.mogrt == "1") { try { var ok2 = cMain.exportAsMotionGraphicsTemplate(true, new Folder(OUT_DIR).fsName); Y.log("mogrt: " + ok2); } catch (e) { Y.log("!! mogrt " + e); } }
    app.project.save(aep);
}

try {
    var env0 = Y.readEnv();
    if (!env0.ae) Y.log("!! ABORT: env ae= is required");
    else if (app.version.indexOf(String(parseInt(env0.ae, 10) - 2000) + ".") != 0) Y.log("!! ABORT: wrong AE version " + app.version + " (wanted " + env0.ae + ")");
    else if (safeToReplace()) build();
    else Y.log("!! ABORT: another project is open (not touched)");
} catch (err) {
    var msg = "(unprintable)";
    try { msg = String(err.message || err) + " @" + String(err.line); } catch (e2) {}
    try { Y.log("FATAL " + msg); } catch (e3) {}
} finally {
    try { app.endSuppressDialogs(false); } catch (e4) {}
    Y.finish();
}
