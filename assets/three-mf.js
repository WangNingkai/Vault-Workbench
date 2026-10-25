(function (root) {
  'use strict';
  const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const fail = (code, path = '') => Object.assign(new Error(code), { code, path });
  const MAX_TRIANGLES = 12000000;
  const MAX_COPIES = 10000;

  async function mesh(file, path, budget) {
    if (file.size > 128 * 1024 * 1024) throw fail('tooLarge', path);
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    let positions;
    if (count && buffer.byteLength === 84 + count * 50) {
      if (count > budget) throw fail('tooLarge', path);
      positions = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < 9; j++) positions[i * 9 + j] = view.getFloat32(84 + i * 50 + 12 + j * 4, true);
        if (i % 16384 === 0) await pause();
      }
    } else {
      const source = new TextDecoder().decode(buffer);
      if (!/^\s*solid(?:\s|$)/.test(source) || !/endsolid/.test(source)) throw fail('invalidMesh', path);
      const values = [];
      const number = '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?';
      const facet = new RegExp('facet\\s+normal\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+outer\\s+loop\\s+((?:vertex\\s+' + number + '\\s+' + number + '\\s+' + number + '\\s+){3})endloop\\s+endfacet', 'g');
      let match;
      while ((match = facet.exec(source))) {
        for (const vertex of match[1].matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) values.push(Number(vertex[1]), Number(vertex[2]), Number(vertex[3]));
        if (values.length / 9 > budget) throw fail('tooLarge', path);
        if (values.length % (4096 * 9) === 0) await pause();
      }
      if ((source.match(/\bfacet\b/g) || []).length !== values.length / 9) throw fail('invalidMesh', path);
      positions = new Float64Array(values);
    }
    if (!positions.length) throw fail('invalidMesh', path);
    return positions;
  }

  async function create(build, getFile, onProgress = () => {}) {
    const summary = root.BuildPlan.summarize([build]);
    if (summary.unresolved) throw fail('unresolved');
    const files = summary.files.filter(file => file.qty > 0).map(item => ({ ...item, file: getFile(item.path) }));
    if (!files.length) throw fail('empty');
    const missing = files.find(item => !item.file);
    if (missing) throw fail('missing', missing.path);
    const copies = files.reduce((sum, item) => sum + item.qty, 0);
    if (copies > MAX_COPIES) throw fail('tooLarge');
    const chunks = [];
    const zip = new root.fflate.Zip((error, chunk) => { if (error) throw error; chunks.push(chunk); });
    const add = (name, text) => {
      const entry = new root.fflate.ZipDeflate(name, { level: 6 });
      zip.add(entry); entry.push(root.fflate.strToU8(text), true);
    };
    add('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="config" ContentType="application/xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
    add('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>');
    const entry = new root.fflate.ZipDeflate('3D/3dmodel.model', { level: 6 });
    zip.add(entry);
    const write = text => entry.push(root.fflate.strToU8(text), false);
    // Bambu Studio uses the Application prefix to enable its project/plate importer.
    // Description records the actual generator; 3mfVersion is the supported format version.
    write('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">' + xml(build.name || 'Vault module') + '</metadata><metadata name="Application">BambuStudio-02.00.00.00</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Description">Exported by Vault Workbench for Bambu Studio / P1S. Review material, supports and brim before slicing.</metadata><resources>');
    const objects = [];
    for (let index = 0; index < files.length; index++) {
      const item = files[index];
      onProgress(index, files.length, item.path);
      const positions = await mesh(item.file, item.path, MAX_TRIANGLES);
      const vertices = new Map();
      const triangles = new Uint32Array(positions.length / 3);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      write(`<object id="${index + 1}" type="model" name="${xml(item.path.split('/').pop())}"><mesh><vertices>`);
      let output = '';
      for (let i = 0; i < positions.length; i += 3) {
        const point = [positions[i], positions[i + 1], positions[i + 2]];
        if (!point.every(Number.isFinite)) throw fail('invalidMesh', item.path);
        point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
        const key = point.join(',');
        if (!vertices.has(key)) {
          vertices.set(key, vertices.size);
          output += `<vertex x="${point[0]}" y="${point[1]}" z="${point[2]}"/>`;
        }
        triangles[i / 3] = vertices.get(key);
        if (i % 12288 === 0) { write(output); output = ''; await pause(); }
      }
      write(output + '</vertices><triangles>'); output = '';
      let validTriangles = 0;
      for (let i = 0; i < triangles.length; i += 3) {
        const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
        // Coincident vertices in source STL produce zero-area faces, not printable geometry.
        if (a === b || a === c || b === c) continue;
        validTriangles++;
        output += `<triangle v1="${a}" v2="${b}" v3="${c}"/>`;
        if (i % 12288 === 0) { write(output); output = ''; await pause(); }
      }
      if (!validTriangles) throw fail('invalidMesh', item.path);
      write(output + '</triangles></mesh></object>');
      objects.push({ id: index + 1, qty: item.qty, path: item.path, min, max, triangles: validTriangles });
    }
    write('</resources><build>');
    const plates = root.PlateLayout.pack(objects);
    // Bambu Studio indexes instances by build order within each object, not by plate order.
    const assignments = new Map();
    plates.forEach(plate => plate.items.forEach(item => assignments.set(`${item.id}:${item.instance}`, { item, plate })));
    for (const object of objects) for (let instance = 0; instance < object.qty; instance++) {
      const { item, plate } = assignments.get(`${object.id}:${instance}`);
      write(`<item objectid="${object.id}" printable="1" transform="${root.PlateLayout.transform(item, plate.origin).join(' ')}"/>`);
    }
    entry.push(root.fflate.strToU8('</build></model>'), true);
    const metadata = (key, value) => `<metadata key="${key}" value="${xml(value)}"/>`;
    const objectSettings = objects.map(object => `<object id="${object.id}">${metadata('name', object.path.split('/').pop())}${metadata('extruder', 1)}<part id="${object.id}" subtype="normal_part">${metadata('name', object.path.split('/').pop())}</part></object>`).join('');
    const plateSettings = plates.map(plate => `<plate>${metadata('plater_id', plate.index + 1)}${metadata('plater_name', `P1S - ${plate.index + 1}`)}${metadata('locked', 'false')}${metadata('print_sequence', 'by layer')}${plate.items.map(item => `<model_instance>${metadata('object_id', item.id)}${metadata('instance_id', item.instance)}${metadata('identify_id', objects.slice(0, item.id - 1).reduce((sum, o) => sum + o.qty, 0) + item.instance + 1)}</model_instance>`).join('')}</plate>`).join('');
    add('Metadata/model_settings.config', '<?xml version="1.0" encoding="UTF-8"?><config>' + objectSettings + plateSettings + '</config>');
    // These are layout-only settings, not a calibrated printer/material profile.
    // Explicit names prompt users to choose their installed presets before slicing.
    add('Metadata/project_settings.config', JSON.stringify({
      printer_model: 'Bambu Lab P1S', printer_variant: '0.4', printer_settings_id: 'Vault P1S layout - select printer preset',
      print_settings_id: 'Vault layout - select process preset', filament_settings_id: ['Vault layout - select filament preset'],
      filament_type: ['PLA'], filament_diameter: ['1.75'], filament_colour: ['#FFFFFF'], filament_ids: ['GFL99'],
      nozzle_diameter: ['0.4'], printable_area: ['0x0', '256x0', '256x256', '0x256'], printable_height: '250',
      bed_exclude_area: ['0x0', '18x0', '18x28', '0x28'], print_sequence: 'by layer'
    }));
    zip.end();
    onProgress(files.length, files.length, '');
    return Object.assign(new Blob(chunks, { type: 'model/3mf' }), { plateCount: plates.length });
  }
  function filename(build) {
    const c = build.configuration;
    const name = (build.name || `Vault-${build.system}-${c.width}${c.depth}-${c.height}`).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'Vault-module';
    return `${name}-${build.count}x.3mf`;
  }
  root.ThreeMF = { create, filename };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ThreeMF;
})(globalThis);
