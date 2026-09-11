import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalStart = proto.start;

// After 9000 m, add a light extra obstacle on roughly every third row.
// It is placed farther ahead than the normal row, so there is still time to react
// and the existing obstacle patterns remain unchanged.
proto.spawn = function () {
  const distance = this.stats.distance as number;
  const completedRow = (this.row as number) - 1;
  originalSpawn.call(this);

  if (distance < 9000 || completedRow < 1) return;
  if (completedRow % 3 !== 0 || completedRow % 7 === 0) return;

  const lane = ((completedRow % 3) - 1) as number;
  const type = completedRow % 2 === 0 ? 'block' : 'pillar';
  this.addItem(type, lane, -111);
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

proto.start = function () {
  originalStart.call(this);
  this.__coinReady = false;
  setCoinReady(false);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const ready = (this.stats.coins as number) >= 2000 && !this.secondLifeUsed;
  if (this.__coinReady !== ready) {
    this.__coinReady = ready;
    setCoinReady(ready);
  }
};
