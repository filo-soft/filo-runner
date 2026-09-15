import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const previousStep = proto.step;

const recoverableHit = (game: any, checkedBefore: Set<any>) => {
  const items = (game.items || []) as any[];
  const runner = game.runner as any;
  for (const item of items) {
    if (!item?.checked || checkedBefore.has(item)) continue;
    if (item.type !== 'pillar' && item.type !== 'block' && item.type !== 'arch') continue;
    const z = Number(item.mesh?.position?.z);
    if (!Number.isFinite(z) || Math.abs(z - 1.2) > .7) continue;
    const x = Number(item.mesh?.position?.x || 0);
    if (Math.abs(x - runner.position.x) > .95) continue;
    return item;
  }
  return undefined;
};

proto.step = function (dt: number) {
  const game = this as any;
  const wasPlaying = game.mode === 'playing';
  const checkedBefore = new Set<any>();

  if (wasPlaying) {
    for (const item of ((game.items || []) as any[])) {
      if (item?.checked) checkedBefore.add(item);
    }
    // Suppress the normal game-over callback for recoverable obstacles only.
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
    if (recoverableHit(game, checkedBefore)) {
      game.mode = 'playing';
      game.shake = Math.max(game.shake || 0, .05);
      if (game.onToast) game.onToast('Удар выдержан');
      return;
    }

    if (game.onOver) game.onOver({ ...game.stats });
    return;
  }
};
