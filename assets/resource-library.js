(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const copy = {
    zh: {
      sections: '工作台功能', buildTitle: '打印配置', buildHint: '选尺寸，核对零件和五金',
      modelsTitle: '全部模型', modelsHint: '中英文搜索，快速找到文件',
      modsTitle: '选配改造件', modsHint: '底座、轮组、提手与壁挂',
      manualsTitle: '组装说明书', manualsHint: '从基础入门到组装安装',
      manualsIntro: '第一次组装，先看使用说明，再按模块选择对应指南。',
      connect: '选择资源文件夹', recommended: '当前配置', ready: '可阅读', missing: '本地缺失', disconnected: '连接后阅读', fallback: '备用语言',
      books: {
        '01': ['使用说明', '先了解规格、零件名称和五金准备。'],
        '02': ['抽屉组装', '锁匙、面板、导轨与抽屉的组装顺序。'],
        '03': ['收纳盒组装', '锁扣、铰链、翻盖与盒体的组装顺序。'],
        '04': ['选配改造', '底座、轮组、提手和背部连接结构。'],
        '05': ['安装说明', '壁挂与桌底安装方式。']
      }
    },
    en: {
      sections: 'Workspace sections', buildTitle: 'Configure a build', buildHint: 'Sizes, printed parts and hardware',
      modelsTitle: 'All models', modelsHint: 'Search by name, size or purpose',
      modsTitle: 'Modifications', modsHint: 'Bases, wheels, handles and mounts',
      manualsTitle: 'Assembly manuals', manualsHint: 'Getting started, assembly and mounting',
      manualsIntro: 'Start with the instructions, then choose the guide for your module.',
      connect: 'Choose resource folder', recommended: 'Your configuration', ready: 'Ready to read', missing: 'Missing locally', disconnected: 'Connect to read', fallback: 'Other language',
      books: {
        '01': ['Getting started', 'Sizes, part names and hardware preparation.'],
        '02': ['Drawer assembly', 'Keys, facades, runners and drawer assembly.'],
        '03': ['Case assembly', 'Latches, hinges, lids and case assembly.'],
        '04': ['Modifications', 'Bases, wheels, handles and backbone assemblies.'],
        '05': ['Mounting', 'Wall and under-desk installation.']
      }
    }
  };
  window.ResourceLibrary = {
    update({ language, system, tab, manualId }) {
      const t = copy[language];
      document.querySelectorAll('[data-library-copy]').forEach(node => { node.textContent = t[node.dataset.libraryCopy]; });
      $('workspace-sections').setAttribute('aria-label', t.sections);
      $('manual-catalog').setAttribute('aria-label', t.manualsTitle);
      const section = ['finder', 'plan'].includes(tab) ? 'build' : tab;
      document.querySelectorAll('[data-workspace-section]').forEach(button => {
        const selected = button.dataset.workspaceSection === section;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      const recommended = system === 'sustainers' ? '03' : '02';
      for (const [id, [title, description]] of Object.entries(t.books)) {
        const manual = VaultResources.manual(id, language);
        const state = !VaultResources.connected ? 'disconnected' : !manual ? 'missing' : 'ready';
        const status = state === 'ready' ? VaultResources.languageLabel(manual.language, language) + ' · ' + (manual.fallback ? t.fallback : t.ready) : t[state];
        const button = $('mbtn-' + id);
        button.innerHTML = `<span class="manual-number" aria-hidden="true">${id}</span><span class="manual-card-body"><strong>${title}</strong><span class="manual-card-description">${description}</span><span class="manual-card-meta"><span class="manual-state" data-state="${state}">${status}</span>${id === recommended ? `<span class="manual-recommended">${t.recommended}</span>` : ''}</span></span>`;
        button.setAttribute('aria-controls', 'manual-reader');
      }
      const book = t.books[manualId];
      const manual = VaultResources.manual(manualId, language);
      $('manual-title').textContent = book[0];
      $('manual-description').textContent = book[1];
      const languageName = manual ? VaultResources.languageLabel(manual.language, language) : '';
      $('manual-language').textContent = manual ? (manual.language === 'zh' ? '中文 PDF' : manual.language === 'en' ? 'English PDF' : languageName + ' PDF') : 'PDF';
      $('manual-connect').hidden = VaultResources.connected;
      $('manual-filename').hidden = !manual;
    },
    read(id) {
      loadPdf(id);
      $('manual-reader').scrollIntoView({ behavior: 'instant', block: 'start' });
      $('manual-reader').focus({ preventScroll: true });
    }
  };
})();
