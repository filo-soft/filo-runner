import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStart = proto.start;
const originalStep = proto.step;

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
  if (!stage) return false;
  let pill = stage.querySelector('.balance-pill') as HTMLElement | null;
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'balance-pill';
    pill.innerHTML = '<span class="balance-label">БАЛАНС</span><b class="balance-value">0</b>';
    stage.appendChild(pill);
  }
  const value = pill.querySelector('.balance-value');
  if (value) {
    const next = String(readBalance());
    if (value.textContent !== next) value.textContent = next;
  }
  return true;
};

const style = document.createElement('style');
style.textContent = `
  .balance-pill {
    position: absolute;
    top: 72px;
    right: 18px;
    z-index: 12;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 11px;
    border: 1px solid rgba(255,255,255,.24);
    border-radius: 999px;
    background: rgba(25,22,32,.58);
    backdrop-filter: blur(10px);
    color: #fff;
    pointer-events: none;
    font-size: 11px;
    line-height: 1;
    letter-spacing: .08em;
  }
  .balance-label { opacity: .62; }
  .balance-value { font-size: 13px; letter-spacing: 0; }
  @media (max-width: 680px) {
    .balance-pill { top: 62px; right: 12px; padding: 6px 9px; gap: 6px; font-size: 9px; }
    .balance-value { font-size: 12px; }
  }
`;
document.head.appendChild(style);

const titleFix = () => {
  const title = document.querySelector('.intro h1') as HTMLElement | null;
  if (!title) return false;
  const span = title.querySelector('span') as HTMLElement | null;
  if (!span) return false;
  if (title.firstChild && title.firstChild.nodeValue !== 'Filo–') {
    title.firstChild.nodeValue = 'Filo–';
  }
  if (span.textContent !== 'Runner.') span.textContent = 'Runner.';
  return true;
};

let titleObserver: MutationObserver | undefined;
const bootUiFixes = () => {
  // The module can be evaluated before <body> exists in some browsers.
  if (!document.body) return;

  const stageReady = ensureBalanceUi();
  const titleReady = titleFix();

  // Watch only until the app's DOM has appeared. The previous observer watched
  // every mutation and then caused its own DOM mutations, which could lock up
  // the page in an endless MutationObserver loop.
  if (!titleObserver && (!stageReady || !titleReady)) {
    titleObserver = new MutationObserver(() => {
      const ready = ensureBalanceUi() && titleFix();
      if (ready) {
        titleObserver?.disconnect();
        titleObserver = undefined;
      }
    });
    titleObserver.observe(document.body, { childList: true, subtree: true });
  }
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
  requestAnimationFrame(bootUiFixes);
};

proto.step = function (dt: number) {
  const beforeCoins = this.stats.coins as number;
  originalStep.call(this, dt);
  const afterCoins = this.stats.coins as number;
  if (afterCoins > beforeCoins) {
    writeBalance(readBalance() + (afterCoins - beforeCoins));
    this.__balanceRunCoins = afterCoins;
  }

  // Bonus coins are deliberately handled here so they remain a collectible
  // without changing the core obstacle collision code.
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

  bootUiFixes();
};

bootUiFixes();
