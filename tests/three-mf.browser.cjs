// Run with: node tests/three-mf.browser.cjs /path/to/agent-browser
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const browser = process.argv[2] || 'agent-browser';
const session = 'vault-3mf-' + process.pid;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-3mf-'));
const run = (...args) => execFileSync(browser, ['--session', session, ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => execFileSync(browser, ['--session', session, 'eval', '--stdin'], { input: code, encoding: 'utf8', timeout: 15000 });
try {
  run('--profile', profile, 'open', pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  run('set', 'media', 'light', 'reduced-motion');
  evaluate(`document.getElementById('plan-add-form').requestSubmit(); document.getElementById('tab-btn-plan').click(); if (currentLang !== 'zh') toggleLanguage();`);
  run('snapshot', '-i');
  evaluate(`document.querySelector('[data-action="export3mf"]').scrollIntoView({behavior:'instant',block:'center'});`);
  run('click', '[data-action="export3mf"]');
  evaluate(`if (!document.querySelector('[data-3mf-status]').textContent.includes('文件夹')) throw Error('Missing disconnected notice: ' + document.querySelector('[data-3mf-status]').textContent);`);
  evaluate(`
    const fixture = 'solid test\\nfacet normal 0 0 1\\nouter loop\\nvertex 0 0 0\\nvertex 1 0 0\\nvertex 0 1 0\\nendloop\\nendfacet\\nendsolid test';
    window.testFiles = BuildPlan.summarize(workspaceStore.value.builds).files.map(item => {
      const file = new File([fixture], item.path.split('/').pop());
      Object.defineProperty(file, 'webkitRelativePath', { value: 'Vault/' + item.path });
      return file;
    });
    VaultResources.connect(testFiles.slice(1));
  `);
  evaluate(`document.querySelector('[data-action="export3mf"]').scrollIntoView({behavior:'instant',block:'center'});`);
  run('click', '[data-action="export3mf"]');
  run('wait', '--fn', `document.querySelector('[data-3mf-status]').textContent.includes('本地缺少 STL')`);
  evaluate(`
    VaultResources.connect(testFiles);
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { if (blob.type === 'model/3mf') window.exportedBlob = blob; return original.call(URL, blob); };
  `);
  run('fill', '#build-0-count', '3');
  evaluate(`document.querySelector('[data-action="export3mf"]').scrollIntoView({behavior:'instant',block:'center'});`);
  run('click', '[data-action="export3mf"]');
  run('wait', '--fn', `!!window.exportedBlob && !document.querySelector('[data-action="export3mf"]').disabled`);
  evaluate(`(async () => {
    const archive = fflate.unzipSync(new Uint8Array(await exportedBlob.arrayBuffer()));
    const model = fflate.strFromU8(archive['3D/3dmodel.model']);
    const config = new DOMParser().parseFromString(fflate.strFromU8(archive['Metadata/model_settings.config']), 'application/xml');
    if (!config.querySelectorAll('plate').length || config.querySelectorAll('model_instance').length !== (model.match(/<item /g) || []).length) throw Error('Invalid plate assignments');
    const expected = BuildPlan.summarize(workspaceStore.value.builds).files.reduce((sum, item) => sum + item.qty, 0);
    if ((model.match(/<item /g) || []).length !== expected) throw Error('Wrong copy count after editing');
    if (!document.querySelector('[data-3mf-status]').textContent.includes('已自动分为')) throw Error('No download confirmation');
  })()`);
  evaluate(`if (currentLang !== 'en') toggleLanguage(); if (document.querySelector('[data-action="export3mf"]').textContent !== 'Auto-plate 3MF') throw Error('Missing English button');`);
  assert.equal(run('errors').trim(), '', 'Browser reported JavaScript errors');
  console.log('PASS: disconnected/missing file notices, bilingual button, export download and edited quantities');
} finally { run('close'); }
