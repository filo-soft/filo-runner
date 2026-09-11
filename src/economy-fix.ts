import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;
const originalMenu = proto.menu;
const originalPause = proto.pause;
const originalResume = proto.resume;

const BALANCE_KEY = 'filo-balance';
const readBalance = () => {
  try {
    const value = Number(localStorage.getItem(BALANCE_KEY) || 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch { return 0; }
};
const writeBalance = (value: number) => {
  try { localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.floor(value)))); } catch { /* local-only economy remains available in memory */ }
};

const ensureBalanceUi = () => {
  const stage = document.querySelector('.stage');
  if (!stage) return null;
  let pill = stage.querySelector('.balance-pill') as HTMLElement | null;
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'balance-pill';
    pill.innerHTML = '<span class="balance-coin" aria-hidden="true"><span>&lt;/&gt;</span></span><b class="balance-value"></b>';
    stage.appendChild(pill);
  }
  const value = pill.querySelector('.balance-value') as HTMLElement | null;
  const text = String(readBalance());
  if (value && value.textContent !== text) value.textContent = text;
  return pill;
};

const syncBalanceUi = (game?: any) => {
  const pill = ensureBalanceUi();
  if (!pill) return;
  const mode = game?.mode ?? (window as any).__runnerGame?.mode;
  pill.classList.toggle('is-visible', mode === 'menu' || mode === 'paused');
};

const style = document.createElement('style');
style.textContent = `
  .balance-pill {
    position: absolute;
    right: 24px;
    bottom: 24px;
    z-index: 12;
    display: none;
    align-items: center;
    gap: 8px;
    padding: 8px 12px 8px 8px;
    border: 1px solid rgba(255,255,255,.28);
    border-radius: 999px;
    background: rgba(25,22,32,.62);
    backdrop-filter: blur(10px);
    color: #fff;
    pointer-events: none;
    line-height: 1;
    white-space: nowrap;
    box-shadow: 0 5px 22px rgba(40,30,20,.12);
  }
  .balance-pill.is-visible { display: flex; }
  .balance-coin {
    position: relative;
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: linear-gradient(135deg,#7565c8,#30258e);
    border: 2px solid #b8a5ea;
    box-shadow: 0 1px 0 #312372, inset 0 1px 2px rgba(255,255,255,.18);
    color: #cdc0ff;
    font: 700 7px/1 Arial,sans-serif;
    letter-spacing: -.8px;
  }
  .balance-coin:after {
    content: '';
    position: absolute;
    inset: 3px;
    border: 1px solid rgba(205,192,255,.7);
    border-radius: 50%;
  }
  .balance-coin span { position: relative; z-index: 1; transform: translateY(-.5px); }
  .balance-value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
  @media (max-width: 680px) {
    .balance-pill { right: 13px; bottom: 13px; padding: 6px 9px 6px 6px; gap: 6px; }
    .balance-coin { width: 25px; height: 25px; }
    .balance-value { font-size: 13px; }
  }
`;
document.head.appendChild(style);

const titleFix = () => {
  const title = document.querySelector('.intro h1') as HTMLElement | null;
  if (!title) return false;
  const span = title.querySelector('span') as HTMLElement | null;
  if (!span) return false;
  if (title.firstChild?.nodeValue !== 'Filo–') title.firstChild && (title.firstChild.nodeValue = 'Filo–');
  if (span.textContent !== 'Runner.') span.textContent = 'Runner.';
  return true;
};

const bootInitialUi = () => {
  if (titleFix()) {
    syncBalanceUi();
    return;
  }
  const observer = new MutationObserver(() => {
    const ready = titleFix();
    syncBalanceUi();
    if (ready) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 5000);
};

const replaceCoinWithBonus = (game: any, coin: any) => {
  const lane = coin.lane as number;
  const z = coin.mesh.position.z as number;
  const y = coin.mesh.position.y as number;
  game.recycle(coin);
  const index = game.items.indexOf(coin);
  if (index >= 0) game.items.splice(index, 1);
  const bonus = game.addItem('bonusCoin', lane, z);
  bonus.mesh.position.y = y;
  bonus.laneX = lane * 2.2;
  bonus.mesh.position.x = bonus.laneX + game.bendOff(z);
  return bonus;
};

proto.start = function () {
  originalStart.call(this);
  this.__balanceRunCoins = 0;
  (window as any).__runnerGame = this;
  syncBalanceUi(this);
};

proto.menu = function () {
  const result = originalMenu.call(this);
  (window as any).__runnerGame = this;
  syncBalanceUi(this);
  return result;
};

proto.pause = function () {
  const result = originalPause.call(this);
  syncBalanceUi(this);
  return result;
};

proto.resume = function () {
  const result = originalResume.call(this);
  syncBalanceUi(this);
  return result;
};

proto.step = function (dt: number) {
  const beforeCoins = this.stats.coins as number;
  originalStep.call(this, dt);
  const afterCoins = this.stats.coins as number;
  if (afterCoins > beforeCoins) {
    writeBalance(readBalance() + (afterCoins - beforeCoins));
    this.__balanceRunCoins = afterCoins;
  }

  if (this.mode === 'playing') {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type !== 'bonusCoin') continue;
      const z = item.mesh.position.z as number;
      if (Math.abs(z - 1.2) < .7 &&
          Math.abs(item.mesh.position.x - this.runner.position.x) < .7 &&
          Math.abs(item.mesh.position.y - (this.groundY + this.jump + .9)) < 1.0) {
        this.stats.coins++;
        writeBalance(readBalance() + 1);
        this.__balanceRunCoins = this.stats.coins;
        this.burst(item.mesh.position);
        this.tone(1100 + (this.stats.coins % 5) * 150, .13, 1700);
        this.recycle(item);
        this.items.splice(i, 1);
        this.stats.score = Math.floor(this.stats.distance) + this.stats.coins * 10;
        this.onStats({ ...this.stats });
      }
    }
  }

  syncBalanceUi(this);
};

bootInitialUi();
