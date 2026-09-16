import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalBuildWorld = proto.buildWorld;
const originalBuildPrototypes = proto.buildPrototypes;
const originalSupportAt = proto.supportAt;
const originalStart = proto.start;
const originalToggleSound = proto.toggleSound;
const originalAnimatePose = proto.animatePose;

const ensureRamp = function () {
  if (this.prototypes.has('ramp')) return;
  const ramp = new T.Group();
  for (let i = 0; i < 7; i++) {
    const h = .22 + i * .22;
    this.box(ramp, 0, h / 2, 2.7 - i * .72, 1.75, h, .78, this.marble);
  }
  this.box(ramp, 0, 1.68, -1.25, 1.75, .18, 2.1, this.marble);
  for (let i = 0; i < 7; i++) this.box(ramp, 0, .03 + i * .22, 2.7 - i * .72, 1.78, .045, .035, this.blue);
  this.prototypes.set('ramp', ramp);
};

const ensureLandmarks = function () {
  if (!this.prototypes.has('statue')) {
    const statue = new T.Group();
    this.box(statue, 0, .12, 0, 1.35, .24, 1.35, this.trim);
    this.box(statue, 0, .38, 0, 1.05, .28, 1.05, this.marble);
    this.mesh(statue, new T.CapsuleGeometry(.25, .82, 5, 12), this.marble, 0, 1.0, 0);
    this.ball(statue, 0, 1.67, 0, .38, .44, .34, this.marble);
    this.mesh(statue, new T.CylinderGeometry(.31, .39, .13, 18), this.trim, 0, .58, 0);
    this.prototypes.set('statue', statue);
  }
  if (!this.prototypes.has('sideTemple')) {
    const temple = new T.Group();
    this.box(temple, 0, .15, 0, 5.2, .3, 2.7, this.trim);
    for (const x of [-1.8, 0, 1.8]) {
      const col = this.makeColumn(3.7);
      col.position.set(x, .3, 0);
      temple.add(col);
    }
    this.box(temple, 0, 4.05, 0, 5.7, .3, 2.9, this.trim);
    const roofShape = new T.Shape();
    roofShape.moveTo(-2.9, 0); roofShape.lineTo(2.9, 0); roofShape.lineTo(0, 1.35); roofShape.closePath();
    this.mesh(temple, new T.ExtrudeGeometry(roofShape, { depth: 2.5, bevelEnabled: false }), this.stone, 0, 4.22, -1.25);
    this.prototypes.set('sideTemple', temple);
  }
  if (!this.prototypes.has('bonusCoin')) {
    const coin = new T.Group();
    const orange = new T.MeshStandardMaterial({ color: '#EB5F3C', roughness: .35, metalness: .25 });
    const orangeLight = new T.MeshStandardMaterial({ color: '#ffb08f', roughness: .38, metalness: .2 });
    const disc = this.mesh(coin, new T.CylinderGeometry(.25, .25, .085, 24), orange);
    disc.rotation.x = Math.PI / 2;
    const ring = this.mesh(coin, new T.TorusGeometry(.205, .019, 6, 24), orangeLight, 0, 0, .055);
    ring.rotation.x = Math.PI / 2;
    const engraving = document.createElement('canvas'); engraving.width = engraving.height = 64;
    const c = engraving.getContext('2d')!; c.fillStyle = '#ffd0bd'; c.font = 'bold 24px monospace'; c.textAlign = 'center'; c.fillText('</>', 32, 40);
    const map = new T.CanvasTexture(engraving); map.colorSpace = T.SRGBColorSpace;
    this.mesh(coin, new T.PlaneGeometry(.35, .35), new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }), 0, 0, .058);
    this.prototypes.set('bonusCoin', coin);
  }
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  ensureRamp.call(this);
  ensureLandmarks.call(this);
};

proto.spawn = function () {
  const t = this.stats.time as number;
  const row = this.row as number;
  const add = (type: string, lane: number, z: number) => this.addItem(type, lane, z);
  const coinLine = (lane: number, z: number, count = 5, step = 1.55, y = .9) => {
    for (let i = 0; i < count; i++) add('coin', lane, z - i * step).mesh.position.y = y;
  };

  if (row > 2 && row % 7 === 0) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const rampZ = -96;
    add('ramp', lane, rampZ);
    // One bonus coin, centered over the landing platform: same shape as the blue </> coin, orange only.
    const bonus = add('bonusCoin', lane, rampZ - 1.25);
    bonus.laneX = lane * 2.2;
    bonus.mesh.position.x = bonus.laneX + this.bendOff(bonus.mesh.position.z);
    bonus.mesh.position.y = 2.32;
    // bonusCoin is pooled: always clear any previous magnet/shield state.
    delete bonus.mesh.userData.bonusType;
    delete bonus.mesh.userData.bonusVisual;
    delete bonus.mesh.userData.bonusPhase;
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

proto.supportAt = function (z: number) {
  let h = originalSupportAt.call(this, z);
  for (const item of this.items as any[]) {
    if (item.type !== 'ramp' || Math.abs(item.mesh.position.x - this.runner.position.x) >= 1.15) continue;
    const rel = z - item.mesh.position.z;
    if (rel >= -1.9 && rel <= 2.9) {
      const p = T.MathUtils.clamp((2.9 - rel) / 4.8, 0, 1);
      const rh = p < .82 ? p * 1.65 : 1.65;
      if (rh > h) h = rh;
    }
  }
  return h;
};