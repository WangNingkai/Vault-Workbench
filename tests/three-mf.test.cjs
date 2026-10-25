const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('../assets/drawer-files.js');
require('../assets/drawers.js');
require('../assets/sustainers.js');
const plan = require('../assets/build-plan.js');
global.fflate = require('../assets/vendor/fflate.min.js');
require('../assets/plate-layout.js');
const exporter = require('../assets/three-mf.js');
const build = (extra = {}) => plan.entry({ system: 'drawers', configuration: { width: 'S', depth: '3', height: '1F', key: 'standard', drawerRoof: 'none', topHandle: false, gearedRails: true }, count: 2, name: '工具 & <抽屉>', ...extra });
const points = [[0,0,0], [1.23456789,0,0], [0,2,0], [0,0,3]];
const faces = [[0,2,1],[0,1,3],[1,2,3],[2,0,3]];
function fixture(binary = true) {
  if (!binary) return new Blob(['solid test\n' + faces.map(face => 'facet normal 0 0 0\nouter loop\n' + face.map(i => 'vertex ' + points[i].join(' ')).join('\n') + '\nendloop\nendfacet\n').join('') + 'endsolid test']);
  const data = new ArrayBuffer(84 + faces.length * 50), view = new DataView(data);
  view.setUint32(80, faces.length, true);
  faces.forEach((face, i) => face.forEach((vertex, j) => points[vertex].forEach((value, k) => view.setFloat32(84 + i * 50 + 12 + j * 12 + k * 4, value, true))));
  return new Blob([data]);
}
async function unpack(blob) { return fflate.unzipSync(new Uint8Array(await blob.arrayBuffer())); }
test('binary and ASCII exports preserve precision, quantities, indexed vertices and package structure', async () => {
  for (const binary of [true, false]) {
    const selected = build(), progress = [];
    const blob = await exporter.create(selected, () => fixture(binary), (...args) => progress.push(args));
    const archive = await unpack(blob);
    assert.deepEqual(Object.keys(archive).sort(), ['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels', 'Metadata/model_settings.config', 'Metadata/project_settings.config'].sort());
    const model = fflate.strFromU8(archive['3D/3dmodel.model']);
    const summary = plan.summarize([selected]);
    assert.equal((model.match(/<object /g) || []).length, summary.files.length);
    assert.equal((model.match(/<item /g) || []).length, summary.files.reduce((sum, item) => sum + item.qty, 0));
    assert.equal((model.match(/<vertex /g) || []).length, summary.files.length * 4);
    assert.equal((model.match(/<triangle /g) || []).length, summary.files.length * 4);
    assert.ok(model.includes('工具 &amp; &lt;抽屉&gt;'));
    assert.ok(model.includes(String(binary ? Math.fround(points[1][0]) : points[1][0])));
    assert.ok(model.includes('unit="millimeter"'));
    assert.equal(progress.at(-1)[0], summary.files.length);
    // Independent ZIP/CRC and XML parser, rather than only the writer's library.
    execFileSync('python3', ['-c', 'import sys,io,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; [E.fromstring(z.read(n)) for n in z.namelist() if n != \"Metadata/project_settings.config\"]'], { input: Buffer.from(await blob.arrayBuffer()) });
  }
});
test('unresolved layouts and missing files block export before any parsing', async () => {
  const selected = build({ system: 'sustainers', configuration: { width: 'L', depth: '3', height: '1F', interior: 'dividers', roof: 'whole' } });
  await assert.rejects(exporter.create(selected, () => { throw Error('must not read'); }), { code: 'unresolved' });
  for (const key of Object.keys(selected.layout)) selected.layout[key] = 0;
  const paths = [];
  await exporter.create(selected, key => { paths.push(key); return fixture(); });
  assert.ok(Object.keys(selected.layout).every(key => !paths.includes(key)));
  await assert.rejects(exporter.create(build(), () => null), error => error.code === 'missing' && !!error.path);
});
test('invalid meshes and excessive copies produce actionable errors', async () => {
  await assert.rejects(exporter.create(build(), () => new Blob(['invalid'])), { code: 'invalidMesh' });
  await assert.rejects(exporter.create(build(), () => new Blob(['solid test\nfacet broken\nendsolid test'])), { code: 'invalidMesh' });
  const data = await fixture().arrayBuffer(); new DataView(data).setFloat32(96, NaN, true);
  await assert.rejects(exporter.create(build(), () => new Blob([data])), { code: 'invalidMesh' });
  await assert.rejects(exporter.create(build({ count: 999 }), () => fixture()), { code: 'tooLarge' });
  assert.equal(exporter.filename(build({ name: 'test/<>:?' })), 'test------2x.3mf');
});
test('real S3 module exports from local source meshes when available', async t => {
  const resourceRoot = path.resolve(__dirname, '../..');
  const selected = build({ count: 1 });
  const summary = plan.summarize([selected]);
  if (!summary.files.every(item => fs.existsSync(path.join(resourceRoot, item.path)))) return t.skip('Local resource pack unavailable');
  const blob = await exporter.create(selected, key => new Blob([fs.readFileSync(path.join(resourceRoot, key))]));
  const archive = await unpack(blob);
  assert.ok(archive['3D/3dmodel.model'].length > 1000);
});

test('coincident source faces are omitted but an entirely collapsed mesh is rejected', async () => {
  const source = await fixture().arrayBuffer();
  const data = new Uint8Array(source.byteLength + 50);
  data.set(new Uint8Array(source));
  new DataView(data.buffer).setUint32(80, 5, true);
  const archive = await unpack(await exporter.create(build(), () => new Blob([data])));
  const model = fflate.strFromU8(archive['3D/3dmodel.model']);
  assert.equal((model.match(/<triangle /g) || []).length, plan.summarize([build()]).files.length * 4);
  const collapsed = new ArrayBuffer(134);
  new DataView(collapsed).setUint32(80, 1, true);
  await assert.rejects(exporter.create(build(), () => new Blob([collapsed])), { code: 'invalidMesh' });
});

test('a printable S4 module is not rejected by a cumulative triangle budget', async t => {
  const resources = require('./resource-root.cjs');
  if (!resources.root) return t.skip('Local resource pack unavailable');
  const selected = build({ count: 1, configuration: { ...build().configuration, depth: '4' } });
  const parts = plan.summarize([selected]).files;
  let triangles = 0;
  for (const part of parts) {
    const file = fs.openSync(path.join(resources.root, part.path), 'r');
    try { const header = Buffer.alloc(84); fs.readSync(file, header, 0, 84, 0); triangles += header.readUInt32LE(80); }
    finally { fs.closeSync(file); }
  }
  assert.ok(triangles > 2000000, 'Fixture must exercise the previous cumulative limit');
  const blob = await exporter.create(selected, key => new Blob([fs.readFileSync(path.join(resources.root, key))]));
  const archive = await unpack(blob);
  const model = fflate.strFromU8(archive['3D/3dmodel.model']);
  assert.equal((model.match(/<item /g) || []).length, parts.reduce((sum, part) => sum + part.qty, 0));
  assert.ok(blob.plateCount >= 1);
});
