import { RunnerGame } from './game';

// Developer-only test mode. It is intentionally not exposed in the UI.
const proto = RunnerGame.prototype as any;
const originalMenu = proto.menu;
const originalStart = proto.start;
const originalDie = proto.die;

proto.menu = function (...args: any[]) {
  (window as any).__filoGodGame = this;
  return originalMenu.apply(this, args);
};

proto.start = function (...args: any[]) {
  (window as any).__filoGodGame = this;
  return originalStart.apply(this, args);
};

proto.toggleGodMode = function () {
  this.__godMode = !this.__godMode;
  if (typeof this.burst === 'function') {
    this.burst(this.runner.position.clone().setY(this.groundY + 1.05).setZ(1.2), false, 4);
  }
  this.shake = Math.max(this.shake || 0, .012);
  window.dispatchEvent(new Event('filo-god-mode-change'));
  return this.__godMode;
};

proto.die = function (...args: any[]) {
  if (this.__godMode) return;
  return originalDie.apply(this, args);
};

window.addEventListener('keydown', e => {
  const game = (window as any).__filoGodGame;
  if (!game || e.repeat) return;

  // KeyA is the physical A key: on a Russian layout it is Ф.
  if (e.code === 'KeyA' && game.mode === 'menu') {
    e.preventDefault();
    game.toggleGodMode();
    return;
  }

  // Developer test controls are available only during an active god-mode run.
  if (!game.__godMode || game.mode !== 'playing') return;
  if (e.code === 'Digit1') { e.preventDefault(); game.launchTestBoulder?.(); }
  if (e.code === 'Digit2') { e.preventDefault(); game.spawnTestPowerup?.('shield'); }
  if (e.code === 'Digit3') { e.preventDefault(); game.spawnTestPowerup?.('magnet'); }
});
