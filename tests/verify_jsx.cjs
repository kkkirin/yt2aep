// AE-independent regression checks. Run: node tests/verify_jsx.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'jsx/lib.jsx'), 'utf8');
const ctx = {__MAIN: {fsName: 'build.jsx'}, app: {version: '26.0'}, File: function(p) {this.fsName = p;}};
vm.createContext(ctx); vm.runInContext(lib, ctx);
ctx.Y.skipOutputs = () => false; ctx.Y.log = () => {};
const duration = 1001 / 30000;
const items = [];
ctx.app.project = {renderQueue: {items: {add() {
    const item = {outputModule: () => ({templates: ['PNG'], applyTemplate() {}}), remove() {}};
    items.push(item); return item;
}}, render() {}}};
ctx.Y.renderFrames({frameRate: 29.97, frameDuration: duration, name: 'main'}, [0, 89], 'out');
assert.equal(items[0].timeSpanDuration, duration, 'use native frameDuration at fractional fps');
assert.equal(items[1].timeSpanStart, 89 * duration, 'start must use native frameDuration');
// Rendering must not execute somebody else's queued output.
const priorCount = items.length;
ctx.app.project.renderQueue.numItems = 1;
ctx.app.project.renderQueue.item = () => ({render: true});
assert.throws(() => ctx.Y.renderFrames({frameRate: 29.97, frameDuration: duration, name: 'main'}, [0], 'out'), /queue/i);
assert.throws(() => ctx.Y.renderComp({name: 'main'}, 'out/main'), /queue/i);
assert.equal(items.length, priorCount, 'abort before adding or rendering queue items');
ctx.app.project.renderQueue.numItems = 0;
const example = fs.readFileSync(path.join(root, 'jsx/examples/build_glitch.jsx'), 'utf8');
assert(fs.readFileSync(path.join(root, 'jsx/examples/build_glitch.jsx')).subarray(0,3).equals(Buffer.from([239,187,191])));
const safety = example.slice(example.indexOf('function safeToReplace()'), example.indexOf('function build()'));
ctx.OUT_DIR = '/tool/output/glitch';
vm.runInContext(safety, ctx);
for (const project of [
    {file: {fsName: '/other/glitch_text_ai.aep'}, numItems: 3, dirty: false},
    {file: {fsName: '/other/work.aep'}, numItems: 3, dirty: true},
    {file: null, numItems: 3, dirty: false},
    {file: null, numItems: 3, dirty: true},
]) {
    ctx.app.project = project;
    assert.equal(ctx.safeToReplace(), false, 'must preserve unrelated projects, including same-named files');
}
ctx.app.project = {file: null, numItems: 0, dirty: false};
assert.equal(ctx.safeToReplace(), true);
ctx.app.project = {file: {fsName: '/tool/output/glitch/glitch_text_ai_simple.aep'}, numItems: 3, dirty: false};
assert.equal(ctx.safeToReplace(), true);
// Validate the standalone exporter without opening a host app.
const renderSource = fs.readFileSync(path.join(root, 'jsx/render_comp.jsx'), 'utf8').replace(/^#include.*$/gm, '');
for (const project of [
    {file: {fsName: '/other/work.aep'}, numItems: 3, dirty: true},
    {file: null, numItems: 3, dirty: true},
    {file: {fsName: '/other/work.aep'}, numItems: 0, dirty: true},
]) {
    let opened = false, finished = false;
    const messages = [];
    const sandbox = {
        $: {fileName: 'render_comp.jsx'},
        File: function(p) {return {fsName: p, exists: true};},
        app: {version: '26.0', project, beginSuppressDialogs() {}, endSuppressDialogs() {}, open() {opened = true;}},
        Y: {readEnv: () => ({ae: '2026', aep: '/tool/output/main.aep', comp: 'main', out: '/tool/output/main'}),
            log: s => messages.push(s), finish() {finished = true;}}
    };
    vm.runInNewContext(renderSource, sandbox);
    assert.equal(opened, false, 'never replace an unrelated project for rendering');
    assert.equal(finished, true, 'always signal completion on abort');
    assert(messages.some(s => s.startsWith('FATAL ')));
}
// Library writes a failure marker for both errors and safety aborts.
const writes = {};
ctx.Y.writeFile = (p, text) => {writes[p] = text;};
ctx.Y.readEnv = () => ({});
ctx.Y.logLines = ['!! ABORT: another project is open'];
ctx.Y.finish();
assert.equal(writes['build.jsx.done'], 'error');
ctx.Y.logLines = ['saved project'];
ctx.Y.finish();
assert.equal(writes['build.jsx.done'], 'ok');
console.log('PASS: fractional-frame render, queue guard, UTF-8 BOM, build/export safety, completion markers');
