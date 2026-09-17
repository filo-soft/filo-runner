import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStart = proto.start;

const BONUS_START = 180;
const BONUS_INTERVAL = 90;

function activeBonus(game: any) {
  const state = game.__bonusRamp;
  if (!state) return false;
  const now = game.stats.time as number;
  return state.magnetUntil > now || state.shieldUntil > now || (game.__shieldLockUntil || 0) > now;
}

function hasPowerupInWorld(game: any) {
  return (game.items as any[]).some((item: any) =>
    item.type === 'bonusCoin' && !!item.mesh.userData.bonusType
  );
}

function removeItem(game: any, item: any) {
  const index = game.items.indexOf(item);
  if (index < 0) return;
  game.recycle(item);
  game.items.splice(index, 1);
}

function removeLegacyPowerups(game: any, beforeItems: Set<any>) {
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (beforeItems.has(item)) continue;
    if (item.type === 'bonusCoin' && item.mesh.userData.bonusType) removeItem(game, item);
  }
}

function purgeAllPowerups(game: any) {
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (item.type === 'bonusCoin' && item.mesh.userData.bonusType) removeItem(game, item);
  }
}

function scheduleWindow(game: any, windowIndex: number) {
  const state = game.__bonusSchedule;
  state.windowIndex = windowIndex;
  state.windowStart = BONUS_START + windowIndex * BONUS_INTERVAL;
  state.targetTime = state.windowStart + Math.random() * BONUS_INTERVAL;
  state.spawned = false;
}

function findStandaloneLane(game: any, z: number) {
  const lanes = [-1, 0, 1];
  const free = lanes.filter((lane) => {
    for (const item of game.items as any[]) {
      if (item.type === 'bonusCoin' || item.lane !== lane) continue;
      if (Math.abs(item.mesh.position.z - z) < 3.2) return false;
    }
    return true;
  });
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

function trySpawnScheduledBonus(game: any, newCoins: any[], time: number) {
  const state = game.__bonusSchedule;
  if (!state || state.spawned || time < state.targetTime) return false;

  // Absolute rule: while any bonus is active, this window cannot create a shield.
  if (activeBonus(game) || hasPowerupInWorld(game)) {
    state.spawned = true;
    purgeAllPowerups(game);
    return false;
  }

  const target = newCoins.length
    ? newCoins[Math.floor(Math.random() * newCoins.length)]
    : null;
  if (!target) return false;

  const z = target.mesh.position.z as number;
  const lane = findStandaloneLane(game, z);
  // Never fall back onto an occupied lane. Wait for a later spawn in this same window.
  if (lane === null) return false;

  const bonus = game.addItem('bonusCoin', lane, z);
  bonus.mesh.position.y = Math.max(target.mesh.position.y as number, .9);
  bonus.lane = lane;
  bonus.laneX = lane * 2.2;
  bonus.mesh.position.x = bonus.laneX + game.bendOff(z);
  bonus.checked = true;
  bonus.mesh.userData.bonusPhase = 'powerup';
  delete bonus.mesh.userData.bonusVisual;
  bonus.mesh.userData.bonusType = 'shield';
  state.spawned = true;
  return true;
}

proto.start = function () {
  originalStart.call(this);
  this.__bonusSchedule = {};
  this.__shieldLockUntil = 0;
  scheduleWindow(this, 0);
};

proto.spawn = function () {
  const time = this.stats.time as number;
  const beforeItems = new Set((this.items as any[]));
  originalSpawn.call(this);

  const state = this.__bonusSchedule || (this.__bonusSchedule = {});
  if (typeof state.windowIndex !== 'number') {
    const initialIndex = time < BONUS_START ? 0 : Math.floor((time - BONUS_START) / BONUS_INTERVAL);
    scheduleWindow(this, initialIndex);
  }

  removeLegacyPowerups(this, beforeItems);

  if (time >= BONUS_START) {
    const currentIndex = Math.floor((time - BONUS_START) / BONUS_INTERVAL);
    if (currentIndex !== state.windowIndex) scheduleWindow(this, currentIndex);
  }

  if (activeBonus(this)) {
    purgeAllPowerups(this);
    return;
  }

  const newItems = (this.items as any[]).filter((item: any) => !beforeItems.has(item));
  const newCoins = newItems.filter((item: any) => item.type === 'coin');
  trySpawnScheduledBonus(this, newCoins, time);
};
