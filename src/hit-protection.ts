import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const previousStep = proto.step;

// Mirror the collision rules from game.ts BEFORE the original step changes `checked`.
// This is deliberately based on jump/duck state, not merely on an obstacle crossing z=1.2,
// so jumping over / sliding under an obstacle does not summon IVAN.
const detectActualHit = (game: any) => {
  const items = (game.items || []) as any[];
  const runner = game.runner as any;
  const speed = Math.min(21, 10.5 + game.stats.time * .12);
  const dt = 1 / 120;

  for (const item of items) {
    if (!item || item.checked) continue;
    const type = item.type;
    if (type !== 'pillar' && type !== 'block' && type !== 'arch') continue;

    const prevZ = Number(item.mesh?.position?.z);
    const nextZ = prevZ + speed * dt;
    if (!Number.isFinite(prevZ) || !(prevZ < 1.2 && nextZ >= 1.2)) continue;
    if (Math.abs(Number(item.mesh?.position?.x || 0) - runner.position.x) >= .87) continue;

    const hit = type === 'pillar'
      || (type === 'block' && game.jump < .95)
      || (type === 'arch' && !(game.duck > .7 && game.jump < .1));
    if (hit) return item;
  }
  return undefined;
};

proto.step = function (dt: number) {
  const game = this as any;
  const wasPlaying = game.mode === 'playing';
  const actualHit = wasPlaying ? detectActualHit(game) : undefined;

  if (wasPlaying) {
    game.__actualHitItem = actualHit;
    game.__hitProtectionOver = true;
  }

  const originalOnOver = game.onOver;
  if (wasPlaying) game.onOver = (() => {}) as any;
  try {
    previousStep.call(this, dt);
  } finally {
    game.onOver = originalOnOver;
    delete game.__hitProtectionOver;
  }

  if (wasPlaying && game.mode === 'over') {
    if (actualHit) {
      game.mode = 'playing';
      game.shake = Math.max(game.shake || 0, .05);
      if (game.onToast) game.onToast('Удар выдержан');
      return;
    }

    if (game.onOver) game.onOver({ ...game.stats });
    return;
  }
};
