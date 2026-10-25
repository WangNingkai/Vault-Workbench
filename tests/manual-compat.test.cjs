const test = require('node:test');
const assert = require('node:assert/strict');
const vault = require('../assets/vault-resources.js');

function file(path, content = 'fixture') {
  const value = new File([content], path.split('/').at(-1));
  Object.defineProperty(value, 'webkitRelativePath', { value: path });
  return value;
}

function index(paths) {
  return vault.createIndex(paths.map(path => file(path)));
}

test('a bilingual edition is used before falling back to the other language', () => {
  const files = index(['Vault/01_Instructions Manual.pdf', 'Vault/01_使用手册_中文对照版.pdf']);
  const zh = vault.findManual(files, '01', 'zh');
  assert.equal(zh.path, '01_使用手册_中文对照版.pdf');
  assert.equal(zh.language, 'bilingual');
  assert.equal(zh.fallback, false);
  assert.equal(zh.pageSafe, false);
  assert.equal(vault.findManual(files, '01', 'en').language, 'en');
});

test('the requested single-language edition still wins over a bilingual edition', () => {
  const files = index(['Vault/01_使用说明书_中文版.pdf', 'Vault/01_使用手册_中文对照版.pdf']);
  const zh = vault.findManual(files, '01', 'zh');
  assert.equal(zh.path, '01_使用说明书_中文版.pdf');
  assert.equal(zh.pageSafe, true);
});

test('decorated file names are recognised without losing page safety for exact editions', () => {
  const files = index([
    'Vault/02_Drawer Assembly (1).pdf',
    'Vault/01_Instructions_Manual_FINAL.pdf',
    'Vault/03 sustainers-assembly.pdf'
  ]);
  const two = vault.findManual(files, '02', 'en');
  assert.equal(two.path, '02_Drawer Assembly (1).pdf');
  assert.equal(two.language, 'en');
  assert.equal(two.pageSafe, true);
  assert.equal(vault.findManual(files, '01', 'en').path, '01_Instructions_Manual_FINAL.pdf');
  assert.equal(vault.findManual(files, '03', 'en').path, '03 sustainers-assembly.pdf');
});

test('numbered files with unknown decorations are still matched but open at page one', () => {
  const files = index(['Vault/Vault_05_Mounting_Instructions_JP.pdf']);
  const manual = vault.findManual(files, '05', 'en');
  assert.equal(manual.language, 'ja');
  assert.equal(manual.fallback, true);
  assert.equal(manual.pageSafe, false);
});

test('other localised editions are disclosed instead of reported as missing', () => {
  const files = index(['Vault/01_Instructions Manual_DE.pdf']);
  const manual = vault.findManual(files, '01', 'zh');
  assert.equal(manual.language, 'de');
  assert.equal(manual.fallback, true);
  assert.equal(vault.languageLabel(manual.language, 'zh'), '德语');
  assert.equal(vault.languageLabel(manual.language, 'en'), 'German');
});

test('an unnumbered file is accepted only when its title identifies one manual', () => {
  const files = index(['Vault/Drawer Assembly.pdf', 'Vault/Manual.pdf']);
  assert.equal(vault.findManual(files, '02', 'en').path, 'Drawer Assembly.pdf');
  assert.equal(vault.findManual(files, '01', 'en'), null);
});

test('a number conflict is never handed to the wrong manual', () => {
  const files = index(['Vault/02_Instructions Manual.pdf', 'Vault/01_Instructions Manual.pdf']);
  assert.equal(vault.findManual(files, '01', 'en').path, '01_Instructions Manual.pdf');
  assert.equal(vault.findManual(files, '02', 'en').path, '02_Instructions Manual.pdf');
});

test('equally good files without a root copy remain ambiguous', () => {
  const files = index([
    'Vault/01. DRAWERS/07. Universal/Latch.stl',
    'Vault/a/01_Drawer Assembly.pdf',
    'Vault/b/01_Drawer Assembly.pdf'
  ]);
  assert.equal(vault.findManual(files, '01', 'en'), null);
});

test('resource root detection accepts renamed manual-only folders', () => {
  const files = index(['Manuals/01_使用手册_中文对照版.pdf', 'Manuals/02_抽屉组装_中文版.pdf']);
  assert.equal(files.name, 'Manuals');
  assert.equal(vault.findManual(files, '01', 'zh').language, 'bilingual');
});
