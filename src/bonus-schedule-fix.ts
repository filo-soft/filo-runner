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
  // late-game-fix still owns the old random/stair implementation. Remove only
  // powerup objects created by that layer during this spawn, leaving orange +10 coins untouched.
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (beforeItems.has(item)) continue;
    if (item.type === 'bonusCoin' && item.mesh.userData.bonusType) removeItem(game, item);
    else if (item.type === 'stairRamp') removeItem(game, item);
  }
}

function scheduleNextWindow(game: any, windowStart: number) {
  const state = game.__bonusSchedule;
  state.windowStart = windowStart;
  state.windowEnd = windowStart + BONUS_INTERVAL;
  // Exactly one random moment inside every 90-second window.
  state.targetTime = windowStart + Math.random() * BONUS_INTERVAL;
  state.spawned = false;
}

function trySpawnScheduledBonus(game: any, newCoins: any[], time: number) {
  const state = game.__bonusSchedule;
  if (!state || time < BONUS_START || state.spawned || time < state.targetTime) return;
  if (activeBonus(game) || hasPowerupInWorld(game)) return;

  const candidates = newCoins.filter((item: any) => item.type === 'coin');
  const target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  if (!target) return;

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
}

proto.start = function () {
  originalStart.call(this);
  this.__bonusSchedule = {};
  scheduleNextWindow(this, BONUS_START);
};

proto.spawn = function () {
  const time = this.stats.time as number;
  const beforeItems = new Set((this.items as any[]));
  originalSpawn.call(this);

  const state = this.__bonusSchedule || (this.__bonusSchedule = {});
  if (typeof state.windowStart !== 'number') scheduleNextWindow(this, BONUS_START);

  // Disable both previous random mechanisms so this schedule is the only normal
  // source of shields after 3:00.
  removeLegacyPowerups(this, beforeItems);

  const newItems = (this.items as any[]).filter((item: any) => !beforeItems.has(item));
  const newCoins = newItems.filter((item: any) => item.type === 'coin');
  trySpawnScheduledBonus(this, newCoins, time);

  // If this 90-second window was completed, advance to the next one. A blocked
  // window is intentionally skipped rather than producing a delayed double spawn.
  if (time >= state.windowEnd) {
    const nextStart = state.windowEnd;
    scheduleNextWindow(this, nextStart);
    if (time >= state.targetTime) trySpawnScheduledBonus(this, newCoins, time);
  }
};
