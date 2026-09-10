import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalBuildWorld = proto.buildWorld;
const originalBuildPrototypes = proto.buildPrototypes;
const originalSupportAt = proto.supportAt;

// Build a climbable Greek marble "ramp/train-car" once.
const ensureRamp = function () {
  if (this.prototypes.has('ramp')) return;
  const ramp = new T.Group();
  // Seven shallow steps create a smooth-looking climb without adding a new asset.
  for (let i = 0; i < 7; i++) {
    const h = .22 + i * .22;
    this.box(ramp, 0, h / 2, 2.7 - i * .72, 1.75, h, .78, this.marble);
  }
  this.box(ramp, 0, 1.68, -1.25, 1.75, .18, 2.1, this.marble);
  for (let i = 0; i < 7; i++) this.box(ramp, 0, .03 + i * .22, 2.7 - i * .72, 1.78, .045, .035, this.blue);
  this.prototypes.set('ramp', ramp);
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  ensureRamp.call(this);
};

proto.spawn = function () {
  const t = this.stats.time as number;
  const row = this.row as number;
  const add = (type: string, lane: number, z: number) => this.addItem(type, lane, z);
  const coinLine = (lane: number, z: number, count = 5, step = 1.55, y = .9) => {
    for (let i = 0; i < count; i++) add('coin', lane, z - i * step).mesh.position.y = y;
  };

  // Bring back the climbable platforms regularly, with a clear landing lane.
  if (row > 2 && row % 7 === 0) {
    const lane = Math.floor(Math.random() * 3) - 1;
    add('ramp', lane, -96);
    coinLine(lane, -91, 7, 1.25, 1.25);
    const safe = lane === 0 ? (row % 2 ? -1 : 1) : 0;
    coinLine(safe, -82, 5, 1.55, .9);
    this.row++;
    return;
  }

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

// Make the climb surface actually raise the runner, while preserving the original platform logic.
proto.supportAt = function (z: number) {
  let h = originalSupportAt.call(this, z);
  for (const item of this.items as any[]) {
    if (item.type !== 'ramp' || Math.abs(item.mesh.position.x - this.runner.position.x) >= 1.0) continue;
    const rel = z - item.mesh.position.z;
    let rh = 0;
    if (rel >= -1.95 && rel <= 3.15) {
      // Descending world-z means approaching the high end first; interpolate up the ramp.
      const p = T.MathUtils.clamp((3.15 - rel) / 5.1, 0, 1);
      rh = p < .82 ? p * 1.62 : 1.62;
    }
    if (rh > h) h = rh;
  }
  return h;
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

// Make the long background temple much higher so its roof cannot cut into the play view.
// Also strengthen the lane curvature so turns are visibly present again.
proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup;
  if (temple) {
    temple.scale.set(1.12, 1.75, 1.12);
    temple.position.y = .9;
  }
};

const originalBendOff = proto.bendOff;
proto.bendOff = function (z: number) {
  return this.bend * T.MathUtils.clamp((-z - 14) / 70, 0, 1) ** 2 * 10;
};

// Keep turns active for a little longer so the player can actually read the curve.
const originalStart = proto.start;
proto.start = function () {
  originalStart.call(this);
  this.bendTimer = 8;
};
