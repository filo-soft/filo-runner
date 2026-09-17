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
  return state.magnetUntil > now || state.shieldUntil > now;
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
  // The schedule is the only normal source of shields. Remove powerups produced
  // by older layers during this spawn, but never touch ordinary orange +10 coins.
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (beforeItems.has(item)) continue;
    if (item.type === 'bonusCoin' && item.mesh.userData.bonusType) removeItem(game, item);
    else if (item.type === 'stairRamp') removeItem(game, item);
  }
}

function scheduleWindow(game: any, windowIndex: number) {
  const state = game.__bonusSchedule;
  state.windowIndex = windowIndex;
  state.windowStart = BONUS_START + windowIndex * BONUS_INTERVAL;
  // Exactly one random target time in this 90-second window.
  state.targetTime = state.windowStart + Math.random() * BONUS_INTERVAL;
  state.spawned = false;
}

function trySpawnScheduledBonus(game: any, newCoins: any[], time: number) {
  const state = game.__bonusSchedule;
  if (!state || state.spawned || time < state.targetTime) return false;
  if (activeBonus(game) || hasPowerupInWorld(game)) return false;

  const candidates = newCoins.filter((item: any) => item.type === 'coin');
  const target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  if (!target) return false;

  const lane = target.lane as number;
  const z = target.mesh.position.z as number;
  const y = target.mesh.position.y as number;
  game.recycle(target);
  const index = game.items.indexOf(target);
  if (index >= 0) game.items.splice(index, 1);

  const bonus = game.addItem('bonusCoin', lane, z);
  bonus.mesh.position.y = y;
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

  // Advance directly to the current 90-second window. This prevents the old
  // boundary bug where crossing a window could spawn two shields in one spawn().
  if (time >= BONUS_START) {
    const currentIndex = Math.floor((time - BONUS_START) / BONUS_INTERVAL);
    if (currentIndex !== state.windowIndex) scheduleWindow(this, currentIndex);
  }

  const newItems = (this.items as any[]).filter((item: any) => !beforeItems.has(item));
  const newCoins = newItems.filter((item: any) => item.type === 'coin');
  trySpawnScheduledBonus(this, newCoins, time);
};
