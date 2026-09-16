import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const ORIGINALS = {
  start: proto.start,
  step: proto.step,
  die: proto.die,
};
const BONUS_DURATION = 15;

function ensureState(game: any) {
  game.__bonusRamp = game.__bonusRamp || { magnetUntil: 0, shieldUntil: 0 };
  return game.__bonusRamp;
}

function updateBonusHud(game: any, state: any) {
  let hud = document.querySelector('.bonus-status') as HTMLDivElement | null;
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'bonus-status';
    game.host?.appendChild(hud);
    const style = document.createElement('style');
    style.textContent = `
      .bonus-status {
        position:absolute;
        top:150px;
        left:28px;
        transform:none;
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        max-width:280px;
        z-index:2;
        pointer-events:none;
        font:700 10px/1 Arial,sans-serif;
        letter-spacing:1px;
        text-transform:uppercase;
      }
      .bonus-badge {
        display:flex;
        align-items:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid #ffffff70;
        border-radius:999px;
        background:#17152dcc;
        color:#fff;
        backdrop-filter:blur(5px);
        box-shadow:0 5px 18px #0002;
      }
      .bonus-dot { width:9px; height:9px; border-radius:50%; }
      .bonus-dot.magnet { background:#e94b62; }
      .bonus-dot.shield { background:#4b72e8; }
      @media(max-width:700px) {
        .bonus-status {
          top:auto;
          left:12px;
          bottom:22px;
          max-width:calc(100vw - 24px);
          font-size:9px;
          gap:6px;
        }
        .bonus-badge { padding:6px 8px; }
      }
    `;
    document.head.appendChild(style);
  }
  const now = game.stats.time as number;
  const parts: string[] = [];
  if (state.magnetUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot magnet"></i>МАГНИТ ${Math.ceil(state.magnetUntil-now)}с</span>`);
  if (state.shieldUntil > now) parts.push(`<span class="bonus-badge"><i class="bonus-dot shield"></i>ЩИТ ${Math.ceil(state.shieldUntil-now)}с</span>`);
  hud.innerHTML = parts.join('');
  hud.style.display = parts.length ? 'flex' : 'none';
}

proto.start = function () {
  ORIGINALS.start.call(this);
  this.__bonusRamp = { magnetUntil: 0, shieldUntil: 0 };
  updateBonusHud(this, this.__bonusRamp);
};

proto.die = function () {
  const state = ensureState(this);
  if (state.shieldUntil > this.stats.time) {
    this.shake = .05;
    this.burst(new T.Vector3(this.runner.position.x, this.groundY + .8, 1.2), true, 10);
    this.tone(240, .08, 520, 'sine');
    this.onToast('Щит выдержал удар');
    return;
  }
  ORIGINALS.die.call(this);
};

proto.step = function (dt: number) {
  const state = ensureState(this);
  ORIGINALS.step.call(this, dt);
  if (this.mode !== 'playing') return;

  const now = this.stats.time as number;

  // Orange bonus coin is the only bonus pickup. It is spawned by late-game-fix
  // only after 3 real minutes, or on the late-game staircase ramp.
  for (let i = this.items.length - 1; i >= 0; i--) {
    const item = this.items[i];
    if (item.type !== 'bonusCoin') continue;
    if (
      Math.abs(item.mesh.position.z - 1.2) < .75 &&
      Math.abs(item.mesh.position.x - this.runner.position.x) < .85 &&
      Math.abs(item.mesh.position.y - (this.groundY + this.jump + .9)) < 1.15
    ) {
      const type: 'magnet' | 'shield' = Math.random() < .5 ? 'magnet' : 'shield';
      if (type === 'magnet') state.magnetUntil = now + BONUS_DURATION;
      else state.shieldUntil = now + BONUS_DURATION;
      this.onToast(type === 'magnet' ? 'Магнит активирован · 15 секунд' : 'Щит активирован · 15 секунд');
      this.tone(type === 'magnet' ? 520 : 360, .15, type === 'magnet' ? 980 : 760);
      this.burst(item.mesh.position, false, 14);
      this.recycle(item);
      this.items.splice(i, 1);
    }
  }

  if (state.magnetUntil > now) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type !== 'coin') continue;
      const dz = item.mesh.position.z - 1.2;
      if (dz < -120 || dz > 3) continue;
      const pull = Math.min(1, dt * 9);
      item.mesh.position.x = T.MathUtils.lerp(item.mesh.position.x, this.runner.position.x, pull);
      item.mesh.position.y = T.MathUtils.lerp(item.mesh.position.y, this.groundY + this.jump + .9, pull);
      if (Math.abs(dz) < .9 && Math.abs(item.mesh.position.x - this.runner.position.x) < 1.0) {
        this.stats.coins++;
        this.burst(item.mesh.position);
        this.tone(700 + (this.stats.coins % 5) * 130, .12, 1350);
        this.recycle(item);
        this.items.splice(i, 1);
      }
    }
  }

  updateBonusHud(this, state);
};
