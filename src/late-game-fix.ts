import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalStart = proto.start;
const originalBuildPrototypes = proto.buildPrototypes;
const originalSupportAt = proto.supportAt;
const originalControl = proto.control;

const BONUS_START_TIME = 180;
const BONUS_CHANCE = .01;
// Magnet remains implemented for a later re-enable and developer test mode,
// but is intentionally excluded from normal gameplay in the stable balance.
const MAGNET_ENABLED = false;

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

const sanitizeCoins = function () {
  const obstacles = (this.items as any[]).filter((item: any) =>
    item.type === 'block' || item.type === 'pillar' || item.type === 'arch'
  );
  const coins = (this.items as any[]).filter((item: any) => item.type === 'coin' || item.type === 'bonusCoin');

  for (const coin of coins) {
    if (coin.mesh.position.y > 1.55) continue;
    const occupied = (lane: number) => obstacles.some((obstacle: any) =>
      obstacle.lane === lane && Math.abs(obstacle.mesh.position.z - coin.mesh.position.z) < 1.05
    );
    if (!occupied(coin.lane)) continue;
    const candidates = [-1, 0, 1]
      .filter((lane) => !occupied(lane))
      .sort((a, b) => Math.abs(a - coin.lane) - Math.abs(b - coin.lane));
    if (candidates.length) {
      const lane = candidates[0];
      coin.lane = lane;
      coin.laneX = lane * 2.2;
      coin.mesh.position.x = coin.laneX + this.bendOff(coin.mesh.position.z);
    } else {
      this.recycle(coin);
      const index = this.items.indexOf(coin);
      if (index >= 0) this.items.splice(index, 1);
    }
  }
};

const activeBonus = function (game: any) {
  const state = game.__bonusRamp;
  if (!state) return false;
  const now = game.stats.time as number;
  return state.magnetUntil > now || state.shieldUntil > now;
};

const hasPowerupInWorld = function (game: any) {
  return (game.items as any[]).some((item: any) =>
    item.type === 'bonusCoin' && !!item.mesh.userData.bonusType
  );
};

const nextPowerupType = function (game: any) {
  game.__bonusRamp = game.__bonusRamp || { magnetUntil: 0, shieldUntil: 0, nextPowerupType: 'magnet' };
  if (!MAGNET_ENABLED) {
    // Preserve the old alternating state so re-enabling the magnet later is trivial,
    // but route every normal powerup spawn to the shield while magnet is disabled.
    return 'shield';
  }
  const type = game.__bonusRamp.nextPowerupType === 'shield' ? 'shield' : 'magnet';
  game.__bonusRamp.nextPowerupType = type === 'magnet' ? 'shield' : 'magnet';
  return type;
};

const replaceBlueCoin = function (coin: any, powerup: boolean) {
  const lane = coin.lane as number;
  const z = coin.mesh.position.z as number;
  const y = coin.mesh.position.y as number;
  this.recycle(coin);
  const index = this.items.indexOf(coin);
  if (index >= 0) this.items.splice(index, 1);

  const bonus = this.addItem('bonusCoin', lane, z);
  bonus.mesh.position.y = y;
  bonus.laneX = lane * 2.2;
  bonus.mesh.position.x = bonus.laneX + this.bendOff(z);
  bonus.checked = true;
  bonus.mesh.userData.bonusPhase = powerup ? 'powerup' : 'orange';
  delete bonus.mesh.userData.bonusVisual;
  if (powerup) bonus.mesh.userData.bonusType = nextPowerupType(this);
  else delete bonus.mesh.userData.bonusType;
};

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
  const time = this.stats.time as number;
  const completedRow = (this.row as number) - 1;
  const beforeItems = new Set((this.items as any[]));
  originalSpawn.call(this);

  // Powerups are a genuinely rare 1% slot, and only one powerup may exist in the world at once.
  if (Math.random() < BONUS_CHANCE && time >= BONUS_START_TIME && !activeBonus(this) && !hasPowerupInWorld(this)) {
    const newCoins = (this.items as any[]).filter((item: any) =>
      !beforeItems.has(item) && item.type === 'coin'
    );
    const target = newCoins[newCoins.length - 1];
    if (target) replaceBlueCoin.call(this, target, true);
  }

  if (distance >= 9000 && completedRow >= 1 && completedRow % 3 === 0 && completedRow % 7 !== 0) {
    const lane = ((completedRow % 3) - 1) as number;
    this.addItem(completedRow % 2 === 0 ? 'block' : 'pillar', lane, -111);
  }

  if (distance >= 8000 && completedRow >= 1 && completedRow % 11 === 0) {
    const baseLane = (((completedRow * 2) % 3) - 1) as number;
    const lanes = [baseLane, baseLane === 1 ? -1 : 1, baseLane === 0 ? -1 : 0];
    this.addItem('block', lanes[0], -106);
    this.addItem('arch', lanes[1], -99);
    this.addItem('pillar', lanes[2], -92);
  }

  // The late stair powerup is also rare and cannot coexist with another powerup.
  if (distance >= 8000 && time >= BONUS_START_TIME && completedRow >= 1 && completedRow % 31 === 0 && !activeBonus(this) && !hasPowerupInWorld(this)) {
    const lane = (((completedRow + 1) % 3) - 1) as number;
    this.addItem('stairRamp', lane, -103);
    const coin = this.addItem('bonusCoin', lane, -104.25);
    coin.laneX = lane * 2.2;
    coin.mesh.position.x = coin.laneX + this.bendOff(coin.mesh.position.z);
    coin.mesh.position.y = 2.32;
    coin.checked = true;
    coin.mesh.userData.bonusPhase = 'powerup';
    delete coin.mesh.userData.bonusVisual;
    coin.mesh.userData.bonusType = nextPowerupType(this);
  }

  sanitizeCoins.call(this);
};

proto.start = function () {
  originalStart.call(this);
  this.__coinReady = false;
  this.__bonusRamp = { magnetUntil: 0, shieldUntil: 0, nextPowerupType: 'magnet' };
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
    this.shake = Math.max(this.shake as number, .18);
    this.tone?.(150, .07, 75, 'triangle');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(32);
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
