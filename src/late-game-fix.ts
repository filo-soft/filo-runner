import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalStart = proto.start;
const originalBuildPrototypes = proto.buildPrototypes;
const originalSupportAt = proto.supportAt;
const originalControl = proto.control;

const ensureExtraRamp = function () {
  if (this.prototypes.has('stairRamp')) return;
  const ramp = new T.Group();
  for (let i = 0; i < 8; i++) {
    const h = .22 + i * .23;
    this.box(ramp, 0, h / 2, 3.1 - i * .62, 1.8, h, .66, this.marble);
  }
  this.box(ramp, 0, 1.84, -1.25, 1.8, .18, 2.0, this.marble);
  this.prototypes.set('stairRamp', ramp);
};

const setCoinReady = function (ready: boolean) {
  const pill = document.querySelector('.coin-pill') as HTMLElement | null;
  if (!pill) return;
  pill.classList.toggle('second-life-ready', ready);
};

const style = document.createElement('style');
style.textContent = `
  .coin-pill.second-life-ready { color: #c95732; }
  .coin-pill.second-life-ready .coin-symbol { color: #c95732; }
`;
document.head.appendChild(style);

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  ensureExtraRamp.call(this);
};

proto.supportAt = function (z: number) {
  let h = originalSupportAt.call(this, z);
  for (const item of this.items as any[]) {
    if (item.type !== 'stairRamp' || Math.abs(item.mesh.position.x - this.runner.position.x) >= 1.15) continue;
    const rel = z - item.mesh.position.z;
    if (rel >= -1.9 && rel <= 3.25) {
      const p = T.MathUtils.clamp((3.25 - rel) / 4.5, 0, 1);
      const rh = p < .82 ? p * 1.84 : 1.84;
      if (rh > h) h = rh;
    }
  }
  return h;
};

proto.spawn = function () {
  const distance = this.stats.distance as number;
  const completedRow = (this.row as number) - 1;
  originalSpawn.call(this);

  if (distance >= 9000 && completedRow >= 1 && completedRow % 3 === 0 && completedRow % 7 !== 0) {
    const lane = ((completedRow % 3) - 1) as number;
    this.addItem(completedRow % 2 === 0 ? 'block' : 'pillar', lane, -111);
  }

  // Rare triple obstacle: requires either a lane change, a jump, or a slide.
  if (distance >= 8000 && completedRow >= 1 && completedRow % 11 === 0) {
    const lane = (((completedRow * 2) % 3) - 1) as number;
    this.addItem('block', lane, -106);
    this.addItem('arch', lane, -99);
    this.addItem('pillar', lane, -92);
  }

  // Separate, rare walkable staircase ramp, not the existing launch ramp.
  if (distance >= 8000 && completedRow >= 1 && completedRow % 19 === 0) {
    const lane = (((completedRow + 1) % 3) - 1) as number;
    this.addItem('stairRamp', lane, -103);
    const coin = this.addItem('bonusCoin', lane, -104.25);
    coin.laneX = lane * 2.2;
    coin.mesh.position.x = coin.laneX + this.bendOff(coin.mesh.position.z);
    coin.mesh.position.y = 2.32;
  }

  // From 10000 m, occasional orange coin at the end of a blue coin line.
  if (distance >= 10000 && completedRow >= 1 && completedRow % 5 === 0 && completedRow % 7 !== 0) {
    const lane = (((completedRow + 1) % 3) - 1) as number;
    const coin = this.addItem('bonusCoin', lane, -82);
    coin.laneX = lane * 2.2;
    coin.mesh.position.x = coin.laneX + this.bendOff(coin.mesh.position.z);
    coin.mesh.position.y = .9;
  }
};

proto.start = function () {
  originalStart.call(this);
  this.__coinReady = false;
  setCoinReady(false);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const ready = (this.stats.coins as number) >= 2000 && !this.secondLifeUsed;
  if (this.__coinReady !== ready) {
    this.__coinReady = ready;
    setCoinReady(ready);
  }

  if ((this as any).__edgeBump) {
    this.shake = Math.max(this.shake as number, .045);
    this.tone?.(180, .045, 120, 'sine');
    (this as any).__edgeBump = false;
  }
};

proto.control = function (action: string) {
  if ((action === 'left' && (this.lane as number) <= -1) || (action === 'right' && (this.lane as number) >= 1)) {
    (this as any).__edgeBump = true;
    return;
  }
  return originalControl.call(this, action);
};
