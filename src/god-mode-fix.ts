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
  // Very small visual pulse for confirmation; no text or HUD is shown.
  if (typeof this.burst === 'function') {
    this.burst(this.runner.position.clone().setY(this.groundY + 1.05).setZ(1.2), false, 4);
  }
  this.shake = Math.max(this.shake || 0, .012);
  return this.__godMode;
};

proto.die = function (...args: any[]) {
  if (this.__godMode) return;
  return originalDie.apply(this, args);
};

window.addEventListener('keydown', e => {
  // KeyA is the physical A key: on a Russian layout it is Ф.
  if (e.code !== 'KeyA' || e.repeat) return;
  const game = (window as any).__filoGodGame;
  if (!game || game.mode !== 'menu') return;
  e.preventDefault();
  game.toggleGodMode();
});
