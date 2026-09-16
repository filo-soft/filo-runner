import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;

type Bonus = { mesh: T.Group; type: 'magnet' | 'shield'; z: number; lane: number; collected: boolean };
type Ramp = { mesh: T.Group; z: number; start: number; end: number; safeEnd: number };

const BONUSES: Bonus[] = [];
const RAMPS: Ramp[] = [];
const ORIGINALS = {
  buildPrototypes: proto.buildPrototypes,
  start: proto.start,
  step: proto.step,
  die: proto.die,
  spawn: proto.spawn,
};

const RAMP_INTERVAL_MIN = 620;
const RAMP_INTERVAL_MAX = 820;
const RAMP_Z = -102;
const RAMP_START = -98;
const RAMP_TOP_START = -91;
const RAMP_END = -68;
const RAMP_SAFE_END = -34;
const BONUS_DURATION = 15;

function makeIcon(kind: 'magnet' | 'shield') {
  const root = new T.Group();
  const glow = new T.MeshBasicMaterial({ color: kind === 'magnet' ? '#e94b62' : '#4b72e8', transparent: true, opacity: .16 });
  const body = new T.MeshStandardMaterial({ color: kind === 'magnet' ? '#d92f49' : '#3157c8', roughness: .3, metalness: .25, emissive: kind === 'magnet' ? '#5a1020' : '#101d64', emissiveIntensity: .45 });
  if (kind === 'magnet') {
    root.add(new T.Mesh(new T.TorusGeometry(.34, .11, 8, 24, Math.PI), body));
    const left = new T.Mesh(new T.BoxGeometry(.2, .38, .22), body); left.position.set(-.29, -.18, 0); root.add(left);
    const right = new T.Mesh(new T.BoxGeometry(.2, .38, .22), body); right.position.set(.29, -.18, 0); root.add(right);
    const glowMesh = new T.Mesh(new T.SphereGeometry(.55, 12, 8), glow); root.add(glowMesh);
  } else {
    const shape = new T.Shape();
    shape.moveTo(0, .58); shape.lineTo(.5, .18); shape.lineTo(.36, -.42); shape.lineTo(0, -.65); shape.lineTo(-.36, -.42); shape.lineTo(-.5, .18); shape.closePath();
    const shield = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelSize: .04, bevelThickness: .04 }), body);
    shield.position.z = -.07; root.add(shield);
    root.add(new T.Mesh(new T.SphereGeometry(.58, 12, 8), glow));
  }
  root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.renderOrder = 8; } });
  return root;
}

function makeRamp() {
  const root = new T.Group();
  const marble = new T.MeshStandardMaterial({ color: '#e9dfcc', roughness: .82 });
  const trim = new T.MeshStandardMaterial({ color: '#f7eddc', roughness: .72 });
  const accent = new T.MeshStandardMaterial({ color: '#5148b7', roughness: .4, metalness: .15 });
  // Five broad stairs: the player runs up from the ground onto the long elevated deck.
  for (let i = 0; i < 5; i++) {
    const step = new T.Mesh(new T.BoxGeometry(6.55, .4 * (i + 1), 1.18), marble);
    step.position.set(0, .2 * (i + 1), RAMP_START + i * 1.18);
    step.castShadow = step.receiveShadow = true;
    root.add(step);
  }
  const deck = new T.Mesh(new T.BoxGeometry(6.55, .34, 22.5), marble);
  deck.position.set(0, 2.08, (RAMP_TOP_START + RAMP_END) / 2);
  deck.castShadow = deck.receiveShadow = true;
  root.add(deck);
  for (const x of [-3.12, 3.12]) {
    const rail = new T.Mesh(new T.BoxGeometry(.12, .16, 22.2), trim);
    rail.position.set(x, 2.31, (RAMP_TOP_START + RAMP_END) / 2); rail.castShadow = true; root.add(rail);
  }
  for (let i = 0; i < 7; i++) {
    const stripe = new T.Mesh(new T.BoxGeometry(6.1, .025, .08), accent);
    stripe.position.set(0, 2.255, RAMP_TOP_START + 1.7 + i * 2.65); root.add(stripe);
  }
  return root;
}

function ensureCollections(game: any) {
  game.__bonusRamp = game.__bonusRamp || { nextRampTravel: RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN), rampCounter: 0, lastTravel: game.travel || 0, magnetUntil: 0, shieldUntil: 0 };
  return game.__bonusRamp;
}

function collectCoin(game: any, item: any) {
  game.stats.coins++;
  game.burst(item.mesh.position);
  game.tone(700 + (game.stats.coins % 5) * 130, .12, 1350);
  game.recycle(item);
  const idx = game.items.indexOf(item);
  if (idx >= 0) game.items.splice(idx, 1);
}

function updateBonusHud(game: any, state: any) {
  let hud = document.querySelector('.bonus-status') as HTMLDivElement | null;
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'bonus-status';
    game.host?.appendChild(hud);
    const style = document.createElement('style');
    style.textContent = `
      .bonus-status{position:absolute;top:92px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:12;pointer-events:none;font:700 10px/1 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase}
      .bonus-badge{display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #ffffff70;border-radius:999px;background:#17152dcc;color:#fff;backdrop-filter:blur(5px);box-shadow:0 5px 18px #0002}
      .bonus-dot{width:9px;height:9px;border-radius:50%}
      .bonus-dot.magnet{background:#e94b62}.bonus-dot.shield{background:#4b72e8}
      @media(max-width:700px){.bonus-status{top:76px;font-size:9px}.bonus-badge{padding:6px 8px}}
    `;
    document.head.appendChild(style);
  }
  const now = game.stats.time as number;
  const parts: string[] = [];
  if (state.magnetUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot magnet"></i>МАГНИТ ${Math.ceil(state.magnetUntil-now)}с</span>`);
  if (state.shieldUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot shield"></i>ЩИТ ${Math.ceil(state.shieldUntil-now)}с</span>`);
  hud.innerHTML = parts.join('');
  hud.style.display = parts.length ? 'flex' : 'none';
}

function spawnRamp(game: any) {
  if (RAMPS.some(r => r.z < 18 && r.z > -125)) return;
  const mesh = makeRamp();
  mesh.position.set(game.bendOff(RAMP_Z), 0, RAMP_Z);
  game.scene.add(mesh);
  const ramp: Ramp = { mesh, z: RAMP_Z, start: RAMP_START, end: RAMP_END, safeEnd: RAMP_SAFE_END };
  RAMPS.push(ramp);
  const state = ensureCollections(game);
  state.rampCounter++;
  // Bonuses are deliberately uncommon: one bonus on roughly every second ramp.
  if (state.rampCounter % 2 === 0) {
    const type = state.rampCounter % 4 === 0 ? 'shield' : 'magnet';
    const lane = state.rampCounter % 3 - 1;
    const bonus = makeIcon(type);
    bonus.position.set(lane * 2.2 + game.bendOff(RAMP_Z), 2.85, -84.5);
    bonus.scale.setScalar(.95);
    game.scene.add(bonus);
    BONUSES.push({ mesh: bonus, type, z: -84.5, lane, collected: false });
  }
}

proto.buildPrototypes = function () {
  ORIGINALS.buildPrototypes.call(this);
  // Kept as a separate patch module so the existing obstacle/item mechanics remain untouched.
};

proto.start = function () {
  ORIGINALS.start.call(this);
  BONUSES.forEach(b => this.scene.remove(b.mesh)); BONUSES.length = 0;
  RAMPS.forEach(r => this.scene.remove(r.mesh)); RAMPS.length = 0;
  this.__bonusRamp = { nextRampTravel: RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN), rampCounter: 0, lastTravel: this.travel, magnetUntil: 0, shieldUntil: 0 };
  updateBonusHud(this, this.__bonusRamp);
};

// Keep normal obstacle generation away from the landing zone and the whole ramp approach.
proto.spawn = function () {
  const state = ensureCollections(this);
  const rampAhead = RAMPS.some(r => r.z < -48 && r.z > -112);
  if (rampAhead) return;
  ORIGINALS.spawn.call(this);
};

proto.die = function () {
  const state = ensureCollections(this);
  if (state.shieldUntil > this.stats.time) {
    this.shake = .05;
    this.burst(new T.Vector3(this.runner.position.x, this.groundY + .8, 1.2), true, 10);
    this.tone(240, .08, 520, 'sine');
    this.onToast('Щит выдержал удар');
    return;
  }
  ORIGINALS.die.call(this);
};

proto.step = function (dt: number) {
  const state = ensureCollections(this);
  const beforeTravel = this.travel as number;
  const beforeTime = this.stats.time as number;
  ORIGINALS.step.call(this, dt);
  if (this.mode !== 'playing') return;
  const speedDistance = Math.max(0, (this.travel as number) - beforeTravel);
  if (speedDistance <= 0) return;

  // Schedule sparse long ramps by travelled distance, not time, so their frequency remains stable as speed rises.
  if ((this.travel as number) >= state.nextRampTravel && !RAMPS.some(r => r.z < 18 && r.z > -125)) {
    spawnRamp(this);
    state.nextRampTravel = (this.travel as number) + RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN);
  }

  const now = this.stats.time as number;
  const moved = speedDistance;
  for (let i = RAMPS.length - 1; i >= 0; i--) {
    const ramp = RAMPS[i];
    ramp.z += moved;
    ramp.mesh.position.z = ramp.z;
    ramp.mesh.position.x = this.bendOff(ramp.z);
    // No obstacles can spawn while this ramp is in the playable approach/landing corridor.
    if (ramp.z > 18) { this.scene.remove(ramp.mesh); RAMPS.splice(i, 1); }
  }

  // Lift the runner while he is on the stairs/deck; the deck deliberately ends open for a clean jump down.
  let rampY = 0;
  for (const ramp of RAMPS) {
    if (ramp.z > -112 && ramp.z < 18) {
      const playerRelative = 1.2 - ramp.z;
      if (playerRelative >= RAMP_START && playerRelative <= RAMP_END + 2) {
        if (playerRelative < RAMP_TOP_START) rampY = Math.min(2, Math.max(0, (playerRelative - RAMP_START) / (RAMP_TOP_START - RAMP_START) * 2));
        else if (playerRelative <= RAMP_END) rampY = 2;
      }
    }
  }
  this.groundY = Math.max(this.groundY, rampY);

  for (let i = BONUSES.length - 1; i >= 0; i--) {
    const bonus = BONUSES[i];
    bonus.z += moved;
    bonus.mesh.position.z = bonus.z;
    bonus.mesh.position.x = bonus.lane * 2.2 + this.bendOff(bonus.z);
    bonus.mesh.rotation.y += dt * 2.4;
    bonus.mesh.rotation.z = Math.sin(this.phase * .7) * .08;
    bonus.mesh.position.y = 2.78 + Math.sin(this.phase * .9 + i) * .1;
    if (!bonus.collected && Math.abs(bonus.z - 1.2) < 1.0 && Math.abs(bonus.mesh.position.x - this.runner.position.x) < .9 && Math.abs(bonus.mesh.position.y - (this.groundY + this.jump + 1.0)) < 1.2) {
      bonus.collected = true;
      if (bonus.type === 'magnet') {
        state.magnetUntil = now + BONUS_DURATION;
        this.onToast('Магнит активирован · 15 секунд');
        this.tone(520, .14, 980);
      } else {
        state.shieldUntil = now + BONUS_DURATION;
        this.onToast('Щит активирован · 15 секунд');
        this.tone(360, .18, 760);
      }
      this.burst(bonus.mesh.position, false, 14);
      this.scene.remove(bonus.mesh);
    }
    if (bonus.z > 18 || bonus.collected) BONUSES.splice(i, 1);
  }

  if (state.magnetUntil > now) {
    const pullRange = 22;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type !== 'coin') continue;
      const dz = item.mesh.position.z - 1.2;
      if (dz < -pullRange || dz > 3) continue;
      const pull = Math.min(1, dt * 9);
      item.mesh.position.x = T.MathUtils.lerp(item.mesh.position.x, this.runner.position.x, pull);
      item.mesh.position.y = T.MathUtils.lerp(item.mesh.position.y, this.groundY + this.jump + .9, pull);
      if (Math.abs(dz) < .9 && Math.abs(item.mesh.position.x - this.runner.position.x) < 1.0) collectCoin(this, item);
    }
  }
  updateBonusHud(this, state);
};

const style = document.createElement('style');
style.textContent = `
@media(max-width:700px){.bonus-status{top:78px}}
`;
document.head.appendChild(style);
