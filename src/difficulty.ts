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
    // Put each coin directly over a stair, using the stair's actual height.
    for (let i = 0; i < 7; i++) {
      const localZ = 2.7 - i * .72;
      const stairHeight = .22 + i * .22;
      const coin = add('coin', lane, rampZ + localZ);
      coin.mesh.position.y = stairHeight + .72;
    }
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

// Quiet, soft Dorian-style ambient loop synthesized locally: no external audio file or sharp hits.
proto.startMusic = function () {
  if (!this.sound || this.musicTimer) return;
  this.unlockAudio();
  const playPhrase = () => {
    if (!this.sound || !this.audio || this.audio.state === 'closed') return;
    const a: AudioContext = this.audio;
    const notes = [293.66, 329.63, 349.23, 392.0, 440.0, 392.0, 349.23, 329.63];
    const base = a.currentTime + .03;
    notes.forEach((freq, i) => {
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = 'sine';
      const t = base + i * .52;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.linearRampToValueAtTime(.014, t + .08);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .48);
      osc.connect(gain); gain.connect(a.destination);
      osc.start(t); osc.stop(t + .5);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  };
  playPhrase();
  this.musicTimer = window.setInterval(playPhrase, 4160);
};

proto.stopMusic = function () {
  if (this.musicTimer) { window.clearInterval(this.musicTimer); this.musicTimer = 0; }
};

proto.unlockSound = function () {
  if (!this.sound) return;
  this.unlockAudio();
  this.startMusic();
};

proto.toggleSound = function () {
  const enabled = originalToggleSound.call(this);
  if (enabled) this.startMusic(); else this.stopMusic();
  return enabled;
};

proto.step = function (dt: number) {
  const beforeDistance = this.stats.distance as number;
  const t = this.stats.time as number;
  const factor = 1.12 + Math.min(.32, Math.max(0, t - 8) * .004);
  const toast = this.onToast;
  this.onToast = (text: string) => {
    if (/^\d+ монет/.test(text)) return;
    if (/^Темп растёт/.test(text)) {
      const last = this.lastTempoToast as number | undefined;
      if (last !== undefined && t - last < 60) return;
      this.lastTempoToast = t;
    }
    toast(text);
  };
  originalStep.call(this, dt * factor);

  // Every 1000m: a marble antiquity landmark stands just outside the track.
  const distance = this.stats.distance as number;
  const next = (this.nextLandmarkDistance as number | undefined) ?? 1000;
  if (distance >= next) {
    const side = Math.random() < .5 ? -1 : 1;
    const statue = this.addItem('statue', side, -112);
    statue.laneX = side * 5.6;
    statue.mesh.position.x = statue.laneX + this.bendOff(statue.mesh.position.z);
    statue.mesh.position.y = .05;
    if (Math.floor(distance / 1000) % 3 === 0) {
      const temple = this.addItem('sideTemple', -side, -118);
      temple.laneX = -side * 8.2;
      temple.mesh.position.x = temple.laneX + this.bendOff(temple.mesh.position.z);
      temple.mesh.position.y = 0;
    }
    this.nextLandmarkDistance = Math.floor(distance / 1000 + 1) * 1000;
  }

  this.onToast = toast;
};

// Keep the temple roof comfortably above the mobile camera view.
proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup;
  if (temple) {
    temple.scale.set(1.12, 1.75, 1.12);
    temple.position.y = .9;
  }
};

// The bends were already in the original game; make them more visible so they are unmistakable.
proto.bendOff = function (z: number) {
  return this.bend * T.MathUtils.clamp((-z - 14) / 70, 0, 1) ** 2 * 10;
};

// Keep both legs readable during the belly-down slide instead of folding them completely into the torso.
proto.animatePose = function () {
  originalAnimatePose.call(this);
  const d = this.duck as number;
  if (d > .08) {
    (this.legs as any[]).forEach(({ thigh, knee }, i) => {
      const s = i === 0 ? 1 : -1;
      thigh.rotation.x = -.58 - d * .22 + s * .08;
      thigh.rotation.z = s * (.12 + d * .08);
      knee.rotation.x = .58 + d * .18;
      knee.rotation.z = -s * .04;
      thigh.visible = true;
      knee.visible = true;
    });
  }
};

proto.start = function () {
  originalStart.call(this);
  this.bendTimer = 8;
  this.nextLandmarkDistance = 1000;
};
