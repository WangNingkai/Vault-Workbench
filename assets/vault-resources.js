(function (root) {
  'use strict';
  const manuals = {
    '01': {
      en: '01_Instructions Manual.pdf',
      zh: '01_使用说明书_中文版.pdf',
      strong: ['instructions manual', 'instruction manual', '使用说明书', '使用手册', '使用说明', 'general instructions', 'general manual', '完整说明'],
      weak: ['instructions', 'instruction', 'manual', '说明书', '说明']
    },
    '02': {
      en: '02_Drawer Assembly.pdf',
      zh: '02_抽屉组装_中文版.pdf',
      strong: ['drawer assembly', 'drawers assembly', 'drawer instructions', 'drawer manual', '抽屉组装', '抽屉装配', '抽屉安装', '抽屉说明'],
      weak: ['drawer', 'drawers', 'assembly', '抽屉', '组装', '装配', '安装']
    },
    '03': {
      en: '03_Sustainers Assembly.pdf',
      zh: '03_承托收纳盒组装_中文版.pdf',
      strong: ['sustainers assembly', 'sustainer assembly', 'case assembly', 'cases assembly', '承托收纳盒组装', '收纳盒组装', '收纳箱组装', '翻盖箱装配', '承托收纳盒', '翻盖箱'],
      weak: ['sustainer', 'sustainers', 'case', '收纳盒', '收纳箱', '承托', '翻盖箱', '组装', '装配']
    },
    '04': {
      en: '04_Modifications.pdf',
      zh: '04_选配改造件_中文版.pdf',
      strong: ['modifications', 'modification guide', '选配改造件', '改装配件', '改造件', '选配改造', '改装件', '改装套件'],
      weak: ['modification', 'modifications', 'mod', '改造', '改装', '选配']
    },
    '05': {
      en: '05_Mounting Instructions.pdf',
      zh: '05_安装说明_中文版.pdf',
      strong: ['mounting instructions', 'mounting manual', 'mounting guide', '安装说明', '安装指南', '安装手册', '壁挂安装'],
      weak: ['mounting', 'mount', '安装', '壁挂']
    }
  };

  const languageNames = {
    zh: { zh: '中文', en: 'Chinese' },
    en: { zh: '英文', en: 'English' },
    bilingual: { zh: '中英对照', en: 'Bilingual' },
    ja: { zh: '日语', en: 'Japanese' },
    ko: { zh: '韩语', en: 'Korean' },
    de: { zh: '德语', en: 'German' },
    fr: { zh: '法语', en: 'French' },
    es: { zh: '西班牙语', en: 'Spanish' },
    it: { zh: '意大利语', en: 'Italian' },
    pt: { zh: '葡萄牙语', en: 'Portuguese' },
    ru: { zh: '俄语', en: 'Russian' },
    nl: { zh: '荷兰语', en: 'Dutch' },
    pl: { zh: '波兰语', en: 'Polish' },
    ar: { zh: '阿拉伯语', en: 'Arabic' },
    he: { zh: '希伯来语', en: 'Hebrew' },
    th: { zh: '泰语', en: 'Thai' }
  };

  const normalize = path => path.normalize('NFC').toLowerCase();
  const category = /^(01\. drawers|02\. sustainers|03\. modifications)$/i;

  // Different print runs name the same manual differently. Strip decorations that
  // never carry meaning, but keep the number, title words and language markers.
  function cleanStem(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/\.[^.]+$/, '')
      .replace(/[（(]\s*\d+\s*[)）]/g, ' ')
      .replace(/(?:^|[\s._-])(?:copy|final|latest|new|old|v\d+(?:\.\d+)*)(?=$|[\s._-])/gi, ' ')
      .replace(/副本|拷贝|最终版|最新版/g, ' ')
      .replace(/[_\-–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function manualNumber(value) {
    const stem = cleanStem(value);
    const lead = stem.match(/^(?:vault[\s._-]*)?0?([1-5])(?![0-9])/);
    if (lead) return '0' + lead[1];
    const anywhere = stem.match(/(?:^|[\s._-])0?([1-5])(?=$|[\s._-])/);
    return anywhere ? '0' + anywhere[1] : null;
  }

  const bilingualPattern = /对照|對照|双语|雙語|中英|英中|bilingual|dual[\s-]?language|side[\s-]?by[\s-]?side/i;
  const scriptPatterns = [
    [/[\u3040-\u30ff]/, 'ja'],
    [/[\uac00-\ud7af]/, 'ko'],
    [/[\u0400-\u04ff]/, 'ru'],
    [/[\u0600-\u06ff]/, 'ar'],
    [/[\u0590-\u05ff]/, 'he'],
    [/[\u0e00-\u0e7f]/, 'th'],
    [/[\u3400-\u9fff]/, 'zh']
  ];
  const languageMarks = [
    [/\b(?:english|eng|en)\b|英文|英语/i, 'en'],
    [/\b(?:chinese|zho|zh|cn)\b|中文|简体|繁体|繁體/i, 'zh'],
    [/\b(?:german|deutsch|ger|de)\b|德语/i, 'de'],
    [/\b(?:french|francais|fra|fre|fr)\b|法语/i, 'fr'],
    [/\b(?:spanish|espanol|spa|es)\b|西班牙语/i, 'es'],
    [/\b(?:italian|italiano|ita|it)\b|意大利语/i, 'it'],
    [/\b(?:portuguese|portugues|por|pt)\b|葡萄牙语/i, 'pt'],
    [/\b(?:dutch|nederlands|nld|nl)\b|荷兰语/i, 'nl'],
    [/\b(?:polish|polski|pol|pl)\b|波兰语/i, 'pl'],
    [/\b(?:russian|russkiy|rus|ru)\b|俄语/i, 'ru'],
    [/\b(?:japanese|nihongo|jpn|jp|ja)\b|日语|日本語/i, 'ja'],
    [/\b(?:korean|hangul|kor|ko)\b|韩语|한국어/i, 'ko'],
    [/\b(?:arabic|ara|ar)\b|阿拉伯语/i, 'ar'],
    [/\b(?:hebrew|heb|he)\b|希伯来语/i, 'he'],
    [/\b(?:thai|tha|th)\b|泰语/i, 'th']
  ];

  function detectLanguage(value) {
    const name = String(value || '');
    if (bilingualPattern.test(name)) return 'bilingual';
    const stem = cleanStem(name);
    for (const [pattern, language] of languageMarks) if (pattern.test(stem)) return language;
    for (const [pattern, language] of scriptPatterns) if (pattern.test(name)) return language;
    // Latin-script files without a language marker are treated as English, the
    // default edition shipped with the resource pack.
    return 'en';
  }

  function keywordHits(stem, id) {
    const entry = manuals[id];
    return {
      strong: entry.strong.some(word => stem.includes(word)),
      weak: entry.weak.some(word => stem.includes(word))
    };
  }

  function inferredId(stem) {
    const matches = Object.keys(manuals).filter(id => manuals[id].strong.some(word => stem.includes(word)));
    return matches.length === 1 ? matches[0] : null;
  }

  function looksLikeManual(name) {
    if (!/\.pdf$/i.test(name)) return false;
    const stem = cleanStem(name);
    const number = manualNumber(name);
    const hasKeyword = Object.keys(manuals).some(id => {
      const hits = keywordHits(stem, id);
      return hits.strong || hits.weak;
    });
    return hasKeyword && (number !== null || inferredId(stem) !== null);
  }

  function languageLabel(language, ui = 'zh') {
    return languageNames[language]?.[ui === 'en' ? 'en' : 'zh'] || language;
  }

  function createIndex(files) {
    const entries = Array.from(files, file => ({ file, parts: (file.webkitRelativePath || file.name).split('/') }));
    const roots = new Set();
    for (const { parts } of entries) {
      const at = parts.findIndex(part => category.test(part));
      if (at >= 0) roots.add(parts.slice(0, at).join('/'));
    }
    if (!roots.size) {
      for (const { parts } of entries) {
        if (looksLikeManual(parts.at(-1))) roots.add(parts.slice(0, -1).join('/'));
      }
    }
    if (!roots.size) throw new Error('invalidFolder');
    if (roots.size > 1) throw new Error('multipleVaults');
    const base = [...roots][0];
    const prefix = base ? base + '/' : '';
    const records = new Map();
    const ambiguous = new Set();
    const names = new Map();
    const pdfs = [];
    const counts = { stl: 0, pdf: 0, image: 0 };
    for (const { file, parts } of entries) {
      const fullPath = parts.join('/');
      if (!fullPath.startsWith(prefix)) continue;
      const path = fullPath.slice(prefix.length);
      if (path.split('/').some(part => part.startsWith('.'))) continue;
      const ext = file.name.split('.').at(-1).toLowerCase();
      const kind = ext === 'stl' ? 'stl' : ext === 'pdf' ? 'pdf' : /^(png|jpe?g|webp|gif)$/.test(ext) ? 'image' : null;
      if (!kind) continue;
      const key = normalize(path);
      const record = { file, path, kind };
      if (kind === 'pdf') pdfs.push(record);
      const name = normalize(file.name);
      if (!names.has(name)) names.set(name, []);
      names.get(name).push(record);
      if (records.has(key) || ambiguous.has(key)) {
        records.delete(key);
        ambiguous.add(key);
      } else records.set(key, record);
    }
    for (const record of records.values()) counts[record.kind]++;
    return { name: base.split('/').at(-1) || entries[0]?.parts[0] || 'Vault', records, ambiguous, names, pdfs, counts };
  }

  function candidateFor(record, id) {
    const name = record.file.name;
    const stem = cleanStem(name);
    const number = manualNumber(name);
    if (number !== null && number !== id) return null;
    if (number === null && inferredId(stem) !== id) return null;
    const language = detectLanguage(name);
    const known = manuals[id];
    let quality;
    let match;
    if (name === known.en || name === known.zh) { quality = 100; match = 'exact'; }
    else if (cleanStem(known.en) === stem || cleanStem(known.zh) === stem) { quality = 90; match = 'normalized'; }
    else if (number === id && keywordHits(stem, id).strong) { quality = 70; match = 'inferred'; }
    else if (number === id && keywordHits(stem, id).weak) { quality = 55; match = 'inferred'; }
    else if (number === id) { quality = 45; match = 'inferred'; }
    else { quality = 60; match = 'keyword'; }
    return { record, language, quality, match };
  }

  function languageRank(language, requested) {
    if (language === requested) return 3;
    if (language === 'bilingual') return 2;
    if (language === (requested === 'zh' ? 'en' : 'zh')) return 1;
    return 0;
  }

  function findManual(index, id, language) {
    if (!index || !manuals[id]) return null;
    const requested = language === 'zh' ? 'zh' : 'en';
    const candidates = (index.pdfs || [])
      .map(record => candidateFor(record, id))
      .filter(Boolean)
      .map(candidate => ({ ...candidate, rank: languageRank(candidate.language, requested) }));
    if (!candidates.length) return null;

    // Language order: requested edition, bilingual edition, the other official
    // language, then any other localised edition.
    const bestRank = Math.max(...candidates.map(candidate => candidate.rank));
    const ranked = candidates.filter(candidate => candidate.rank === bestRank);
    const bestQuality = Math.max(...ranked.map(candidate => candidate.quality));
    const matched = ranked.filter(candidate => candidate.quality === bestQuality);
    // Equal matches are only resolved when one copy sits at the resource root.
    const rootCopies = matched.filter(candidate => !candidate.record.path.includes('/'));
    const pool = rootCopies.length ? rootCopies : matched;
    if (pool.length > 1) return null;

    const winner = pool[0];
    const bilingual = winner.language === 'bilingual';
    const fallback = winner.language !== requested && !bilingual;
    return {
      ...winner.record,
      language: winner.language,
      fallback,
      // Page mappings are only trusted for the official file name in the
      // requested language. Renamed files, bilingual and translated editions
      // keep their own pagination, so the reader opens at page one.
      pageSafe: winner.language === requested && winner.quality >= 90,
      match: winner.match
    };
  }

  let index = null;
  const urls = new Map();
  function clearURLs() {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }
  function change(next) {
    clearURLs();
    index = next;
    if (root.dispatchEvent) root.dispatchEvent(new Event('vaultchange'));
  }
  const api = {
    createIndex, findManual, manuals, languageLabel,
    get index() { return index; },
    get connected() { return index !== null; },
    connect(files) { const next = createIndex(files); change(next); return next; },
    disconnect() { change(null); },
    getFile(path) { return index?.records.get(normalize(path))?.file || null; },
    getURL(path) {
      const file = api.getFile(path);
      if (!file) return null;
      const key = normalize(path);
      if (!urls.has(key)) urls.set(key, URL.createObjectURL(file));
      return urls.get(key);
    },
    manual(id, language) { return findManual(index, id, language); }
  };
  root.VaultResources = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
