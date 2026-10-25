// Run explicitly: node tests/three-mf-bambu.cjs /path/to/BambuStudio
// Uses an isolated temporary data directory; never slices or sends print jobs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
require('../assets/drawer-files.js'); require('../assets/drawers.js'); require('../assets/sustainers.js');
const plan = require('../assets/build-plan.js'); require('../assets/plate-layout.js');
global.fflate = require('../assets/vendor/fflate.min.js');
const exporter = require('../assets/three-mf.js');
const resources = require('./resource-root.cjs');
(async () => {
  if (!resources.root) throw Error('Vault resource pack required');
  const binary = process.argv[2] || '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-p1s-roundtrip-'));
  const depth = process.argv[3] || '3';
  const width = process.argv[4] || 'S';
  const selected = plan.entry({ system:'drawers', configuration:plan.normalizeConfiguration('drawers',{width,depth,height:'1F'}), count:1, name:`${width}${depth} P1S validation` });
  const blob = await exporter.create(selected, key => new Blob([fs.readFileSync(path.join(resources.root,key))]));
  assert.ok(blob.plateCount > 1, 'Fixture must exercise multiple plates');
  const input = path.join(directory,'input.3mf'), output = path.join(directory,'output.3mf');
  fs.writeFileSync(input, Buffer.from(await blob.arrayBuffer()));
  const log = fs.openSync(path.join(directory,'bambu.log'),'w');
  try { execFileSync(binary, ['--datadir',path.join(directory,'profile'),'--debug','3','--info','--arrange','0','--orient','0','--export-3mf',output,input], { cwd:directory, stdio:['ignore',log,log], timeout:120000 }); }
  finally { fs.closeSync(log); }
  const inspect = filename => JSON.parse(execFileSync('python3', ['-c', `
import sys,zipfile,xml.etree.ElementTree as E,json
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 root=E.fromstring(z.read('Metadata/model_settings.config'))
 meta=lambda e:{m.get('key'):m.get('value') for m in e.findall('metadata')}
 names={o.get('id'):meta(o).get('name') for o in root.findall('object')}
 plates=[]
 for p in root.findall('plate'):
  items=[meta(i) for i in p.findall('model_instance')]
  plates.append(sorted([names[i['object_id']] + ':' + i['instance_id'] for i in items]))
 c=json.loads(z.read('Metadata/project_settings.config'))
 print(json.dumps(dict(plates=plates,printer=c['printer_model'],area=c['printable_area'],height=c['printable_height'])))
`, filename], { encoding:'utf8' }));
  assert.deepEqual(inspect(output),inspect(input), 'Native roundtrip must preserve plate membership and printer geometry');
  console.log(`PASS: Bambu Studio retained ${blob.plateCount} P1S plates and ${plan.summarize([selected]).files.reduce((sum,item)=>sum+item.qty,0)} instances. Artifacts: ${directory}`);
})().catch(error => { console.error(error); process.exitCode=1; });
