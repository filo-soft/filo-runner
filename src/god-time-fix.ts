import { RunnerGame } from './game';

// Developer-only god-mode helper. Key 4 adds 30 seconds to the test clock.
const proto = RunnerGame.prototype as any;
const originalMenu = proto.menu;
const originalStart = proto.start;

proto.menu = function (...args: any[]) {
  (window as any).__filoGodGame = this;
  return originalMenu.apply(this, args);
};

proto.start = function (...args: any[]) {
  (window as any).__filoGodGame = this;
  return originalStart.apply(this, args);
};

proto.addGodTime = function () {
  if (this.mode !== 'playing' || !this.__godMode) return;
  this.stats.time += 30;
  this.onToast('Время +30 секунд');
};

window.addEventListener('keydown', e => {
  const game = (window as any).__filoGodGame;
  if (!game || e.repeat) return;
  if (e.code === 'Digit4' && game.__godMode && game.mode === 'playing') {
    e.preventDefault();
    game.addGodTime();
  }
});
