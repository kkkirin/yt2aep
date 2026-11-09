// ビルド後に別実行するプレビュー。現在のプロジェクトの指定コンポを PNG 化。
// --env "comps=main:12,main:40" out=<既存フォルダの絶対パス>
var __MAIN = File($.fileName);
#include "lib.jsx"
try {
    app.beginSuppressDialogs();
    var env = Y.readEnv();
    if (!env.ae || app.version.indexOf(String(parseInt(env.ae, 10) - 2000) + ".") != 0) throw new Error("AE version does not match env ae=");
    if (!env.comps || !env.out) throw new Error("comps= and out= are required");
    if (!new Folder(env.out).exists) throw new Error("Create output folder before running");
    Y.enableFileWrite();
    var specs = env.comps.split(","), byName = {};
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i); if (it instanceof CompItem) byName[it.name] = it;
    }
    for (var k = 0; k < specs.length; k++) {
        var nm = specs[k].split(":")[0], fr = parseInt(specs[k].split(":")[1] || "0", 10);
        if (!byName[nm]) throw new Error("Comp not found: " + nm);
        if (isNaN(fr) || fr < 0 || fr * byName[nm].frameDuration >= byName[nm].duration) throw new Error("Frame out of range: " + specs[k]);
        Y.preview(byName[nm], fr, env.out);
    }
} catch (err) {
    Y.log("FATAL " + String(err.message || err));
} finally {
    try { app.endSuppressDialogs(false); } catch (e) {}
    Y.finish();
}
