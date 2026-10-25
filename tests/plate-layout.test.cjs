const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../assets/plate-layout.js');
const object = (id, w, d, h = 20, qty = 1) => ({ id, path: `part-${id}.stl`, min: [-20, 40, -8], max: [w - 20, d + 40, h - 8], qty });
function validate(objects, plates) {
  const seen = new Set();
  for (const plate of plates) {
    for (const item of plate.items) {
      const key = `${item.id}:${item.instance}`;
      assert.ok(!seen.has(key)); seen.add(key);
      const w = item.footprintWidth, d = item.footprintDepth;
      assert.ok(item.x >= 5 && item.y >= 5 && item.x + w <= 251 && item.y + d <= 251);
      assert.ok(item.x >= 18 || item.y >= 28, 'cutter exclusion must stay empty');
      const matrix = layout.transform(item, plate.origin);
      const corners = [];
      for (const x of [item.min[0], item.max[0]]) for (const y of [item.min[1], item.max[1]]) for (const z of [item.min[2], item.max[2]]) {
        corners.push([x * matrix[0] + y * matrix[3] + z * matrix[6] + matrix[9], x * matrix[1] + y * matrix[4] + z * matrix[7] + matrix[10], x * matrix[2] + y * matrix[5] + z * matrix[8] + matrix[11]]);
      }
      const minimum = [0,1,2].map(axis => Math.min(...corners.map(c => c[axis])));
      const maximum = [0,1,2].map(axis => Math.max(...corners.map(c => c[axis])));
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(minimum[axis] - [plate.origin[0] + item.x, plate.origin[1] + item.y, 0][axis]) < 1e-9);
        assert.ok(Math.abs(maximum[axis] - minimum[axis] - [w,d,item.height][axis]) < 1e-9);
      }
      for (const other of plate.items) {
        if (other === item) continue;
        const ow = other.footprintWidth, od = other.footprintDepth;
        assert.ok(item.x + w + 6 <= other.x + 1e-9 || other.x + ow + 6 <= item.x + 1e-9 || item.y + d + 6 <= other.y + 1e-9 || other.y + od + 6 <= item.y + 1e-9, 'parts must keep 6 mm clearance');
      }
    }
  }
  assert.equal(seen.size, objects.reduce((sum, o) => sum + o.qty, 0));
}
test('P1S packs copies across plates with cutter exclusion and Bambu grid origins', () => {
  const objects = [object(1,200,200,40,5),object(2,25,35,12,10)];
  const plates = layout.pack(objects);
  assert.equal(plates.length, 5);
  assert.deepEqual(plates.map(p=>p.origin), [[0,0],[307.2,0],[614.4,0],[0,-307.2],[307.2,-307.2]]);
  validate(objects, plates);
  assert.deepEqual(layout.pack(objects), plates);
});
test('in-plane rotation uses spare space without changing print orientation or scale', () => {
  const objects = [object(1,155,230),object(2,230,50)];
  const plates = layout.pack(objects);
  assert.equal(plates.length,1);
  assert.ok(plates[0].items.some(item=>item.rotated));
  validate(objects,plates);
});
test('oversize and height violations fail with the source filename; excess plates fail explicitly', () => {
  for (const item of [object(1,400,20),object(1,20,20,251),object(1,246,246)]) {
    assert.throws(()=>layout.pack([item]), error=>error.code==='oversized' && error.path===item.path);
  }
  assert.throws(()=>layout.pack([object(1,200,200,10,37)]), { code:'tooManyPlates' });
});
test('seeded mixed layouts retain every copy without collisions or out-of-bed placement', () => {
  let seed=42;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<50;n++) {
    const objects=Array.from({length:12},(_,i)=>object(i+1,10+Math.floor(random()*180),10+Math.floor(random()*180),1+Math.floor(random()*249),1+Math.floor(random()*3)));
    validate(objects,layout.pack(objects));
  }
});

test('the 254 x 47 mm M1F facade fits diagonally with full edge clearance', () => {
  const objects = [object(1,254,47,10)];
  objects[0].path = '01. DRAWERS/02. M Families/Facades/M1F (Turn On Supports).stl';
  const plates = layout.pack(objects);
  assert.equal(plates.length,1);
  assert.equal(plates[0].items.length,1);
  validate(objects, plates);
  const item = plates[0].items[0];
  assert.ok(item.angle > 0 && item.angle < 90);
  const transform = layout.transform(item,plates[0].origin);
  const corners=[];
  for(const x of [item.min[0],item.max[0]]) for(const y of [item.min[1],item.max[1]]) {
    corners.push([x*transform[0]+y*transform[3]+transform[9],x*transform[1]+y*transform[4]+transform[10]]);
  }
  for(const [x,y] of corners) assert.ok(x>=5-1e-9 && x<=251+1e-9 && y>=5-1e-9 && y<=251+1e-9);
  assert.equal(transform[8],1,'Must retain the original Z print orientation');
});

test('diagonal copies keep their clearance across multiple plates', () => {
  const objects = [object(1,254,47,10,7),object(2,30,40,15,4)];
  const plates = layout.pack(objects);
  assert.ok(plates.length > 1);
  validate(objects,plates);
});
