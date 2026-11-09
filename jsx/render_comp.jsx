// 指定 AEP の指定コンポを書き出す。開いている別作業には触れない。
// --env aep=<AEPの絶対パス> comp=<コンポ名> out=<出力の絶対パス・拡張子なし>
var __MAIN = File($.fileName);
#include "lib.jsx"
try {
    app.beginSuppressDialogs();
    var env = Y.readEnv();
    if (!env.ae || app.version.indexOf(String(parseInt(env.ae, 10) - 2000) + ".") != 0) throw new Error("AE version does not match env ae=");
    if (!env.aep || !env.comp || !env.out) throw new Error("aep=, comp= and out= are required");
    var aep = new File(env.aep);
    if (!aep.exists) throw new Error("AEP not found: " + aep.fsName);
    var p = app.project;
    var same = p && p.file && p.file.fsName == aep.fsName;
    if (!same && p && (p.dirty || p.numItems > 0 || p.file)) throw new Error("Another project is open; save and close it before running");
    if (!same) app.open(aep);
    var comp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof CompItem && it.name == env.comp) { comp = it; break; }
    }
    if (!comp) throw new Error("Comp not found: " + env.comp);
    Y.enableFileWrite();
    if (!Y.renderComp(comp, env.out)) throw new Error("No output template matched");
} catch (err) {
    Y.log("FATAL " + String(err.message || err));
} finally {
    try { app.endSuppressDialogs(false); } catch (e) {}
    Y.finish();
}
