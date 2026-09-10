import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

// Escalating Subway-Surfers-style obstacle patterns plus a stronger speed ramp.
proto.spawn = function () {
  const t = this.stats.time as number;
  const row = this.row as number;
  const add = (type: string, lane: number, z: number) => this.addItem(type, lane, z);
  const coinLine = (lane: number, z: number, count = 5, step = 1.55, y = .9) => {
    for (let i = 0; i < count; i++) add('coin', lane, z - i * step).mesh.position.y = y;
  };

  if (t < 12) { originalSpawn.call(this); return; }
  const r = row % 8;
  if (t < 25) {
    const lane = Math.floor(Math.random() * 3) - 1;
    if (r % 2 === 0) { add('block', lane, -80); coinLine(lane === -1 ? 1 : -1, -75); }
    else { add('arch', lane, -80); coinLine(lane === 1 ? -1 : 1, -75); }
  } else if (t < 45) {
    const safe = Math.floor(Math.random() * 3) - 1;
    const blocked = [-1, 0, 1].filter((l: number) => l !== safe);
    if (r % 3 === 0) { add('block', blocked[0], -80); add('pillar', blocked[1], -80); }
    else if (r % 3 === 1) { add('arch', blocked[0], -80); add('pillar', blocked[1], -80); }
    else { add('block', blocked[0], -80); add('arch', blocked[1], -80); }
    coinLine(safe, -75, 6, 1.45);
  } else if (t < 70) {
    const safe = Math.floor(Math.random() * 3) - 1;
    const other = [-1, 0, 1].filter((l: number) => l !== safe);
    add(r % 2 ? 'arch' : 'block', other[0], -80);
    add(r % 3 ? 'pillar' : 'block', other[1], -80);
    if (r % 4 === 0) add('arch', safe, -94);
    coinLine(safe, -75, 5, 1.5);
  } else {
    const safe = Math.floor(Math.random() * 3) - 1;
    const lanes = [-1, 0, 1].filter((l: number) => l !== safe);
    const pattern = r % 4;
    if (pattern === 0) { add('block', lanes[0], -80); add('pillar', lanes[1], -80); add('arch', safe, -96); }
    else if (pattern === 1) { add('arch', lanes[0], -80); add('block', lanes[1], -80); add('pillar', safe, -96); }
    else if (pattern === 2) { add('pillar', lanes[0], -80); add('arch', lanes[1], -80); add('block', safe, -96); }
    else { add('block', lanes[0], -80); add('arch', lanes[1], -80); add('pillar', lanes[0], -98); }
    coinLine(safe, -75, 6, 1.35);
  }
  this.row++;
};

proto.step = function (dt: number) {
  const t = this.stats.time as number;
  // Start about 12% faster, then continue ramping up with the run.
  const factor = 1.12 + Math.min(.32, Math.max(0, t - 8) * .004);
  const toast = this.onToast;
  this.onToast = (text: string) => { if (!/^\d+ монет/.test(text)) toast(text); };
  originalStep.call(this, dt * factor);
  this.onToast = toast;
};

// Raise the large background temple so its roof stays out of the mobile camera view.
proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup;
  if (temple) {
    temple.scale.set(1.12, 1.42, 1.12);
    temple.position.y = .15;
  }
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
};
