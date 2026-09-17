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
  // Only suppress legacy power-up items. Never delete stair ramps/obstacles here.
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (beforeItems.has(item)) continue;
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

function chooseStandaloneLane(game: any, z: number, fallback: number) {
  const lanes = [-1, 0, 1];
  const score = (lane: number) => {
    let occupied = 0;
    for (const item of game.items as any[]) {
      if (item.lane !== lane) continue;
      const dz = Math.abs(item.mesh.position.z - z);
      if (dz < 2.2 && item.type !== 'bonusCoin') occupied++;
    }
    return occupied;
  };
  lanes.sort((a, b) => score(a) - score(b));
  return score(lanes[0]) === 0 ? lanes[0] : fallback;
}

function trySpawnScheduledBonus(game: any, newCoins: any[], time: number) {
  const state = game.__bonusSchedule;
  if (!state || state.spawned || time < state.targetTime) return false;

  // A power-up window is consumed if the player already has a bonus active.
  // This prevents a second shield from appearing in a later spawn while the first is active.
  if (activeBonus(game) || hasPowerupInWorld(game)) {
    state.spawned = true;
    return false;
  }

  const target = newCoins.length
    ? newCoins[Math.floor(Math.random() * newCoins.length)]
    : null;
  if (!target) return false;

  const z = target.mesh.position.z as number;
  const y = target.mesh.position.y as number;
  const lane = chooseStandaloneLane(game, z, target.lane as number);

  // Do NOT replace or recycle a blue coin. The shield is a separate item on an
  // otherwise free lane, so it can never visually become part of a coin chain.
  const bonus = game.addItem('bonusCoin', lane, z);
  bonus.mesh.position.y = Math.max(y, .9);
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

  // Jump directly to the current window so crossing a boundary cannot process
  // multiple windows and create multiple shields.
  if (time >= BONUS_START) {
    const currentIndex = Math.floor((time - BONUS_START) / BONUS_INTERVAL);
    if (currentIndex !== state.windowIndex) scheduleWindow(this, currentIndex);
  }

  const newItems = (this.items as any[]).filter((item: any) => !beforeItems.has(item));
  const newCoins = newItems.filter((item: any) => item.type === 'coin');
  trySpawnScheduledBonus(this, newCoins, time);
};
