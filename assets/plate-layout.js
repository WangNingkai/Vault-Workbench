(function (root) {
  'use strict';
  // P1S profile and plate coordinates: BambuStudio resources/profiles/BBL and PartPlate.cpp.
  const profile = Object.freeze({ width: 256, depth: 256, height: 250, margin: 5, gap: 6, maxPlates: 36,
    excluded: Object.freeze({ x: 0, y: 0, w: 18, h: 28 }), stride: 307.2 });
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const contains = (a, b) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
  function subtract(free, used) {
    const split = [];
    for (const r of free) {
      if (!intersects(r, used)) { split.push(r); continue; }
      if (used.x > r.x) split.push({ ...r, w: used.x - r.x });
      if (used.x + used.w < r.x + r.w) split.push({ ...r, x: used.x + used.w, w: r.x + r.w - used.x - used.w });
      if (used.y > r.y) split.push({ ...r, h: used.y - r.y });
      if (used.y + used.h < r.y + r.h) split.push({ ...r, y: used.y + used.h, h: r.y + r.h - used.y - used.h });
    }
    return split.filter((r, i) => r.w > 0 && r.h > 0 && !split.some((other, j) => i !== j && contains(other, r) && (!contains(r, other) || j < i)));
  }
  function newPlate() {
    const edge = profile.margin - profile.gap / 2;
    // Inflate the cutter exclusion before packing padded object bounds.
    return { items: [], free: subtract([{ x: edge, y: edge, w: profile.width - edge * 2, h: profile.depth - edge * 2 }],
      { ...profile.excluded, w: profile.excluded.w + profile.margin, h: profile.excluded.h + profile.margin }) };
  }
  function orientation(item, angle) {
    const radians = angle * Math.PI / 180;
    const cosine = angle === 90 ? 0 : Math.cos(radians), sine = angle === 0 ? 0 : Math.sin(radians);
    const x = [], y = [];
    for (const px of [item.min[0], item.max[0]]) for (const py of [item.min[1], item.max[1]]) {
      x.push(px * cosine - py * sine); y.push(px * sine + py * cosine);
    }
    const minimum = [Math.min(...x), Math.min(...y)];
    return { angle, cosine, sine, minimum, width: Math.max(...x) - minimum[0], depth: Math.max(...y) - minimum[1] };
  }
  function candidate(plate, item) {
    let best = null;
    for (const r of plate.free) for (const direction of item.orientations) {
      const w = direction.width + profile.gap, h = direction.depth + profile.gap;
      if (w > r.w || h > r.h) continue;
      const short = Math.min(r.w - w, r.h - h), long = Math.max(r.w - w, r.h - h);
      if (!best || short < best.short || (short === best.short && long < best.long)) best = { x: r.x, y: r.y, w, h, direction, short, long };
    }
    return best;
  }
  function pack(objects) {
    const items = [];
    for (const object of objects) {
      const [width, depth, height] = object.max.map((value, axis) => value - object.min[axis]);
      const item = { ...object, width, depth, height };
      item.orientations = [orientation(item, 0), orientation(item, 90)];
      // Long narrow parts can fit diagonally without tilting the print or reducing scale.
      if (!candidate(newPlate(), item)) item.orientations.push(...Array.from({ length: 89 }, (_, index) => orientation(item, index + 1)));
      if (![width, depth, height].every(v => Number.isFinite(v) && v >= 0) || height > profile.height || !candidate(newPlate(), item)) {
        throw Object.assign(new Error('oversized'), { code: 'oversized', path: object.path, dimensions: [width, depth, height] });
      }
      for (let instance = 0; instance < object.qty; instance++) items.push({ ...item, instance });
    }
    items.sort((a, b) => b.width * b.depth - a.width * a.depth || Math.max(b.width, b.depth) - Math.max(a.width, a.depth) || a.id - b.id || a.instance - b.instance);
    const plates = [];
    for (const item of items) {
      let plate, placement;
      for (const existing of plates) {
        const next = candidate(existing, item);
        if (next) { plate = existing; placement = next; break; }
      }
      if (!plate) {
        if (plates.length >= profile.maxPlates) throw Object.assign(new Error('tooManyPlates'), { code: 'tooManyPlates' });
        plate = newPlate(); plates.push(plate); placement = candidate(plate, item);
      }
      plate.free = subtract(plate.free, placement);
      const { direction } = placement;
      plate.items.push({ ...item, x: placement.x + profile.gap / 2, y: placement.y + profile.gap / 2,
        angle: direction.angle, rotated: direction.angle !== 0, direction, footprintWidth: direction.width, footprintDepth: direction.depth });
    }
    const columns = Math.ceil(Math.sqrt(plates.length));
    return plates.map((plate, index) => ({ index, origin: [index % columns * profile.stride, 0 - Math.floor(index / columns) * profile.stride], items: plate.items }));
  }
  function transform(item, origin) {
    const x = origin[0] + item.x, y = origin[1] + item.y;
    const { cosine, sine, minimum } = item.direction;
    return [cosine, sine, 0, -sine, cosine, 0, 0, 0, 1, x - minimum[0], y - minimum[1], -item.min[2]];
  }
  root.PlateLayout = { profile, pack, transform };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PlateLayout;
})(globalThis);
