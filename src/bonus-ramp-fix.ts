import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;

type Bonus = { mesh: T.Group; type: 'magnet' | 'shield'; z: number; lane: number; collected: boolean };
type Ramp = { mesh: T.Group; z: number; bonusZ?: number };

const BONUSES: Bonus[] = [];
const RAMPS: Ramp[] = [];
const ORIGINALS = { start: proto.start, step: proto.step, die: proto.die, spawn: proto.spawn };

const RAMP_INTERVAL_MIN = 620;
const RAMP_INTERVAL_MAX = 820;
const RAMP_Z = -104;
const RAMP_START = 0;
const RAMP_TOP_START = 7;
const RAMP_END = 30;
const RAMP_SAFE_END = 58;
const BONUS_DURATION = 15;

function makeIcon(kind: 'magnet' | 'shield') {
  const root = new T.Group();
  const glow = new T.MeshBasicMaterial({ color: kind === 'magnet' ? '#e94b62' : '#4b72e8', transparent: true, opacity: .16 });
  const body = new T.MeshStandardMaterial({ color: kind === 'magnet' ? '#d92f49' : '#3157c8', roughness: .3, metalness: .25, emissive: kind === 'magnet' ? '#5a1020' : '#101d64', emissiveIntensity: .45 });
  if (kind === 'magnet') {
    const horseshoe = new T.Mesh(new T.TorusGeometry(.34, .11, 8, 24, Math.PI), body);
    horseshoe.rotation.z = Math.PI; root.add(horseshoe);
    const left = new T.Mesh(new T.BoxGeometry(.2, .38, .22), body); left.position.set(-.29, -.18, 0); root.add(left);
    const right = new T.Mesh(new T.BoxGeometry(.2, .38, .22), body); right.position.set(.29, -.18, 0); root.add(right);
  } else {
    const shape = new T.Shape(); shape.moveTo(0, .58); shape.lineTo(.5, .18); shape.lineTo(.36, -.42); shape.lineTo(0, -.65); shape.lineTo(-.36, -.42); shape.lineTo(-.5, .18); shape.closePath();
    const shield = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelSize: .04, bevelThickness: .04 }), body);
    shield.position.z = -.07; root.add(shield);
  }
  root.add(new T.Mesh(new T.SphereGeometry(.58, 12, 8), glow));
  root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.renderOrder = 8; } });
  return root;
}

function makeRamp() {
  const root = new T.Group();
  const marble = new T.MeshStandardMaterial({ color: '#e9dfcc', roughness: .82 });
  const trim = new T.MeshStandardMaterial({ color: '#f7eddc', roughness: .72 });
  const accent = new T.MeshStandardMaterial({ color: '#5148b7', roughness: .4, metalness: .15 });
  // Five broad stairs lead onto a long elevated deck; the deck ends completely open for the jump down.
  for (let i = 0; i < 5; i++) {
    const step = new T.Mesh(new T.BoxGeometry(6.55, .4 * (i + 1), 1.18), marble);
    step.position.set(0, .2 * (i + 1), .6 + i * 1.18); step.castShadow = step.receiveShadow = true; root.add(step);
  }
  const deck = new T.Mesh(new T.BoxGeometry(6.55, .34, 23.0), marble);
  deck.position.set(0, 2.08, 18.5); deck.castShadow = deck.receiveShadow = true; root.add(deck);
  for (const x of [-3.12, 3.12]) {
    const rail = new T.Mesh(new T.BoxGeometry(.12, .16, 22.2), trim);
    rail.position.set(x, 2.31, 18.5); rail.castShadow = true; root.add(rail);
  }
  for (let i = 0; i < 7; i++) {
    const stripe = new T.Mesh(new T.BoxGeometry(6.1, .025, .08), accent);
    stripe.position.set(0, 2.255, 9.3 + i * 2.65); root.add(stripe);
  }
  return root;
}

function ensureState(game: any) {
  game.__bonusRamp = game.__bonusRamp || { nextRampTravel: RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN), rampCounter: 0, magnetUntil: 0, shieldUntil: 0 };
  return game.__bonusRamp;
}

function updateBonusHud(game: any, state: any) {
  let hud = document.querySelector('.bonus-status') as HTMLDivElement | null;
  if (!hud) {
    hud = document.createElement('div'); hud.className = 'bonus-status'; game.host?.appendChild(hud);
    const style = document.createElement('style');
    style.textContent = `.bonus-status{position:absolute;top:92px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:12;pointer-events:none;font:700 10px/1 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase}.bonus-badge{display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #ffffff70;border-radius:999px;background:#17152dcc;color:#fff;backdrop-filter:blur(5px);box-shadow:0 5px 18px #0002}.bonus-dot{width:9px;height:9px;border-radius:50%}.bonus-dot.magnet{background:#e94b62}.bonus-dot.shield{background:#4b72e8}@media(max-width:700px){.bonus-status{top:76px;font-size:9px}.bonus-badge{padding:6px 8px}}`;
    document.head.appendChild(style);
  }
  const now = game.stats.time as number;
  const parts: string[] = [];
  if (state.magnetUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot magnet"></i>МАГНИТ ${Math.ceil(state.magnetUntil-now)}с</span>`);
  if (state.shieldUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot shield"></i>ЩИТ ${Math.ceil(state.shieldUntil-now)}с</span>`);
  hud.innerHTML = parts.join(''); hud.style.display = parts.length ? 'flex' : 'none';
}

function spawnRamp(game: any) {
  if (RAMPS.some(r => r.z < 20 && r.z > -130)) return;
  const mesh = makeRamp(); mesh.position.set(game.bendOff(RAMP_Z), 0, RAMP_Z); game.scene.add(mesh);
  const ramp: Ramp = { mesh, z: RAMP_Z }; RAMPS.push(ramp);
  const state = ensureState(game); state.rampCounter++;
  // Deliberately rare: one bonus on every second ramp, never both together.
  if (state.rampCounter % 2 === 0) {
    const type = state.rampCounter % 4 === 0 ? 'shield' : 'magnet';
    const lane = state.rampCounter % 3 - 1;
    const bonusZ = RAMP_Z + 15;
    const bonus = makeIcon(type);
    bonus.position.set(lane * 2.2 + game.bendOff(bonusZ), 2.95, bonusZ); bonus.scale.setScalar(.95); game.scene.add(bonus);
    BONUSES.push({ mesh: bonus, type, z: bonusZ, lane, collected: false }); ramp.bonusZ = bonusZ;
  }
}

proto.start = function () {
  ORIGINALS.start.call(this);
  BONUSES.forEach(b => this.scene.remove(b.mesh)); BONUSES.length = 0;
  RAMPS.forEach(r => this.scene.remove(r.mesh)); RAMPS.length = 0;
  this.__bonusRamp = { nextRampTravel: RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN), rampCounter: 0, magnetUntil: 0, shieldUntil: 0 };
  updateBonusHud(this, this.__bonusRamp);
};

// While a ramp and its landing corridor are active, do not add normal obstacles.
proto.spawn = function () {
  if (RAMPS.some(r => r.z < RAMP_SAFE_END && r.z > -120)) return;
  ORIGINALS.spawn.call(this);
};

proto.die = function () {
  const state = ensureState(this);
  if (state.shieldUntil > this.stats.time) {
    this.shake = .05; this.burst(new T.Vector3(this.runner.position.x, this.groundY + .8, 1.2), true, 10);
    this.tone(240, .08, 520, 'sine'); this.onToast('Щит выдержал удар'); return;
  }
  ORIGINALS.die.call(this);
};

proto.step = function (dt: number) {
  const state = ensureState(this);
  const beforeTravel = this.travel as number;
  ORIGINALS.step.call(this, dt);
  if (this.mode !== 'playing') return;
  const moved = Math.max(0, (this.travel as number) - beforeTravel);
  if (moved <= 0) { updateBonusHud(this, state); return; }
  const now = this.stats.time as number;

  if ((this.travel as number) >= state.nextRampTravel && !RAMPS.some(r => r.z < 20 && r.z > -130)) {
    spawnRamp(this);
    state.nextRampTravel = (this.travel as number) + RAMP_INTERVAL_MIN + Math.random() * (RAMP_INTERVAL_MAX - RAMP_INTERVAL_MIN);
  }

  for (let i = RAMPS.length - 1; i >= 0; i--) {
    const ramp = RAMPS[i]; ramp.z += moved; ramp.mesh.position.z = ramp.z; ramp.mesh.position.x = this.bendOff(ramp.z);
    if (ramp.z > 20) { this.scene.remove(ramp.mesh); RAMPS.splice(i, 1); }
  }

  // Surface height follows the stairs and then the flat deck. At the open end it drops to ground.
  let rampY = 0;
  for (const ramp of RAMPS) {
    const rel = 1.2 - ramp.z;
    if (rel >= RAMP_START && rel < RAMP_TOP_START) rampY = Math.max(rampY, (rel / RAMP_TOP_START) * 2);
    else if (rel >= RAMP_TOP_START && rel <= RAMP_END) rampY = Math.max(rampY, 2);
  }
  this.groundY = Math.max(this.groundY, rampY);

  for (let i = BONUSES.length - 1; i >= 0; i--) {
    const bonus = BONUSES[i]; bonus.z += moved; bonus.mesh.position.z = bonus.z; bonus.mesh.position.x = bonus.lane * 2.2 + this.bendOff(bonus.z);
    bonus.mesh.rotation.y += dt * 2.4; bonus.mesh.rotation.z = Math.sin(this.phase * .7) * .08; bonus.mesh.position.y = 2.88 + Math.sin(this.phase * .9 + i) * .1;
    if (!bonus.collected && Math.abs(bonus.z - 1.2) < 1.0 && Math.abs(bonus.mesh.position.x - this.runner.position.x) < .9 && Math.abs(bonus.mesh.position.y - (this.groundY + this.jump + 1)) < 1.25) {
      bonus.collected = true;
      if (bonus.type === 'magnet') { state.magnetUntil = now + BONUS_DURATION; this.onToast('Магнит активирован · 15 секунд'); this.tone(520, .14, 980); }
      else { state.shieldUntil = now + BONUS_DURATION; this.onToast('Щит активирован · 15 секунд'); this.tone(360, .18, 760); }
      this.burst(bonus.mesh.position, false, 14); this.scene.remove(bonus.mesh);
    }
    if (bonus.z > 18 || bonus.collected) BONUSES.splice(i, 1);
  }

  if (state.magnetUntil > now) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]; if (item.type !== 'coin') continue;
      const dz = item.mesh.position.z - 1.2; if (dz < -24 || dz > 3) continue;
      const pull = Math.min(1, dt * 9);
      item.mesh.position.x = T.MathUtils.lerp(item.mesh.position.x, this.runner.position.x, pull);
      item.mesh.position.y = T.MathUtils.lerp(item.mesh.position.y, this.groundY + this.jump + .9, pull);
      if (Math.abs(dz) < .9 && Math.abs(item.mesh.position.x - this.runner.position.x) < 1.0) {
        this.stats.coins++; this.burst(item.mesh.position); this.tone(700 + (this.stats.coins % 5) * 130, .12, 1350);
        this.recycle(item); this.items.splice(i, 1);
      }
    }
  }
  updateBonusHud(this, state);
};
