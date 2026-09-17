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
// Magnet remains implemented for a later re-enable and for developer test mode,
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
    // Keep the old alternation state in place so re-enabling the magnet later
    // remains straightforward, but route every normal spawn to the shield.
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

const activateBonus = function (game: any, item: any) {
  const state = game.__bonusRamp || (game.__bonusRamp = { magnetUntil: 0, shieldUntil: 0, nextPowerupType: 'magnet' });
  const now = game.stats.time as number;
  if (now < BONUS_START_TIME || activeBonus(game) || (item.mesh.userData.bonusType === 'magnet' && !MAGNET_ENABLED)) return;

  const type = item.mesh.userData.bonusType === 'shield' ? 'shield' : 'magnet';
  if (type === 'magnet') state.magnetUntil = now + 15;
  else state.shieldUntil = now + 15;

  game.onToast(type === 'magnet' ? 'Магнит активирован · 15 секунд' : 'Щит активирован · 15 секунд');
  game.tone(type === 'magnet' ? 520 : 360, .15, type === 'magnet' ? 980 : 760);
  game.burst(item.mesh.position, false, 14);
  const index = game.items.indexOf(item);
  if (index >= 0) {
    game.recycle(item);
    game.items.splice(index, 1);
  }
  // A collected powerup is the only one that may become active. Clear any queued
  // powerups so the player cannot run through stale magnets/shields and collect them later.
  for (let i = game.items.length - 1; i >= 0; i--) {
    const queued = game.items[i];
    if (queued.type === 'bonusCoin' && queued.mesh.userData.bonusType) {
      game.recycle(queued); game.items.splice(i, 1);
    }
  }
};

proto.start = function () {
  originalStart.call(this);
  this.__coinReady = false;
  this.__bonusRamp = { magnetUntil: 0, shieldUntil: 0, nextPowerupType: 'magnet' };
  setCoinReady(false);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const now = this.stats.time as number;
  const state = this.__bonusRamp || (this.__bonusRamp = { magnetUntil: 0, shieldUntil: 0, nextPowerupType: 'magnet' });

  // Normal gameplay never creates a magnet while the stable balance flag is off.
  // A developer-forced magnet can still exist, but it is not activated here.
  for (let i = this.items.length - 1; i >= 0; i--) {
    const item = this.items[i];
    if (item.type === 'bonusCoin' && item.mesh.userData.bonusType === 'magnet' && !MAGNET_ENABLED && !this.__godMode) {
      this.recycle(item);
      this.items.splice(i, 1);
    }
  }

  if (this.mode === 'playing') {
    const ready = (this.stats.coins as number) >= 2000 && !this.secondLifeUsed;
    if (this.__coinReady !== ready) {
      this.__coinReady = ready;
      setCoinReady(ready);
    }
  }

  if (state.magnetUntil > now && !MAGNET_ENABLED) state.magnetUntil = 0;

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
