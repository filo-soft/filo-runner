import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const ORIGINALS = {
  start: proto.start,
  step: proto.step,
  die: proto.die,
};
const BONUS_DURATION = 15;
const BONUS_START_TIME = 180;

type BonusType = 'magnet' | 'shield';

function ensureState(game: any) {
  game.__bonusRamp = game.__bonusRamp || { magnetUntil: 0, shieldUntil: 0 };
  return game.__bonusRamp;
}

function restoreOrangeVisual(game: any, item: any) {
  const root = item.mesh as T.Group;
  const template = game.prototypes.get('bonusCoin') as T.Group | undefined;
  if (!template) return;
  while (root.children.length) root.remove(root.children[0]);
  for (const child of template.children) root.add(child.clone(true));
  root.userData.bonusVisual = false;
  delete root.userData.bonusType;
}

function makeBonusVisual(item: any, type: BonusType) {
  const root = item.mesh as T.Group;
  while (root.children.length) root.remove(root.children[0]);

  const material = type === 'magnet'
    ? new T.MeshStandardMaterial({ color: '#e94b62', emissive: '#6b1625', emissiveIntensity: .35, metalness: .2, roughness: .3 })
    : new T.MeshStandardMaterial({ color: '#4b72e8', emissive: '#162b72', emissiveIntensity: .35, metalness: .2, roughness: .3 });
  const glow = new T.MeshBasicMaterial({ color: type === 'magnet' ? '#ff6b80' : '#7190ff', transparent: true, opacity: .18 });

  if (type === 'magnet') {
    const bar = new T.BoxGeometry(.18, .62, .18);
    const left = new T.Mesh(bar, material); left.position.set(-.22, .12, 0); root.add(left);
    const right = new T.Mesh(bar, material); right.position.set(.22, .12, 0); root.add(right);
    const arc = new T.Mesh(new T.TorusGeometry(.22, .09, 8, 18, Math.PI), material);
    arc.rotation.z = Math.PI; arc.position.y = .34; root.add(arc);
    const tip1 = new T.Mesh(new T.BoxGeometry(.22, .16, .22), material); tip1.position.set(-.22, -.2, 0); root.add(tip1);
    const tip2 = new T.Mesh(new T.BoxGeometry(.22, .16, .22), material); tip2.position.set(.22, -.2, 0); root.add(tip2);
  } else {
    const shape = new T.Shape();
    shape.moveTo(0, .42); shape.lineTo(.36, .18); shape.lineTo(.28, -.18); shape.lineTo(0, -.42); shape.lineTo(-.28, -.18); shape.lineTo(-.36, .18); shape.closePath();
    const shield = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2 }), material);
    shield.position.z = -.065; root.add(shield);
  }

  const aura = new T.Mesh(new T.SphereGeometry(.62, 16, 12), glow);
  root.add(aura);
  root.userData.bonusType = type;
  root.userData.bonusVisual = true;
}

function removeItem(game: any, item: any) {
  const index = game.items.indexOf(item);
  if (index >= 0) {
    game.recycle(item);
    game.items.splice(index, 1);
  }
}

function activateBonus(game: any, item: any) {
  const state = ensureState(game);
  const now = game.stats.time as number;
  if (now < BONUS_START_TIME) return;

  const type: BonusType = item.mesh.userData.bonusType === 'shield' ? 'shield' : 'magnet';
  if (type === 'magnet') state.magnetUntil = now + BONUS_DURATION;
  else state.shieldUntil = now + BONUS_DURATION;

  game.onToast(type === 'magnet' ? 'Магнит активирован · 15 секунд' : 'Щит активирован · 15 секунд');
  game.tone(type === 'magnet' ? 520 : 360, .15, type === 'magnet' ? 980 : 760);
  game.burst(item.mesh.position, false, 14);
  removeItem(game, item);
}

function prepareBonusItems(game: any) {
  const now = game.stats.time as number;
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (item.type !== 'bonusCoin') continue;

    // bonusCoin is the original orange +10 pickup unless it carries an explicit powerup type.
    // Never delete the orange coin before 180 seconds.
    const type = item.mesh.userData.bonusType as BonusType | undefined;
    if (!type) {
      if (item.mesh.userData.bonusVisual) restoreOrangeVisual(game, item);
      item.checked = true;
      continue;
    }

    // Powerups are unavailable before 3 real minutes.
    if (now < BONUS_START_TIME) {
      delete item.mesh.userData.bonusType;
      restoreOrangeVisual(game, item);
      item.checked = true;
      continue;
    }

    item.checked = true;
    if (!item.mesh.userData.bonusVisual) makeBonusVisual(item, type);
  }
}

function collectBonusesBeforeCollision(game: any) {
  if ((game.stats.time as number) < BONUS_START_TIME) return;
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (item.type !== 'bonusCoin' || !item.mesh.userData.bonusType) continue;
    if (
      Math.abs(item.mesh.position.z - 1.2) < .9 &&
      Math.abs(item.mesh.position.x - game.runner.position.x) < .9 &&
      Math.abs(item.mesh.position.y - (game.groundY + game.jump + .9)) < 1.2
    ) {
      activateBonus(game, item);
    }
  }
}

function updateBonusHud(game: any, state: any) {
  let hud = document.querySelector('.bonus-status') as HTMLDivElement | null;
  if (!hud) {
    hud = document.createElement('div');
    hud.className = 'bonus-status';
    game.host?.appendChild(hud);
    const style = document.createElement('style');
    style.textContent = `
      .bonus-status { position:absolute; top:82px; left:28px; transform:none; display:flex; flex-wrap:wrap; gap:7px; max-width:280px; z-index:2; pointer-events:none; font:700 10px/1 Arial,sans-serif; letter-spacing:1px; text-transform:uppercase; }
      .bonus-badge { display:flex; align-items:center; gap:6px; padding:7px 10px; border:1px solid #ffffff70; border-radius:999px; background:#17152dcc; color:#fff; backdrop-filter:blur(5px); box-shadow:0 5px 18px #0002; }
      .bonus-dot { width:9px; height:9px; border-radius:50%; }
      .bonus-dot.magnet { background:#e94b62; }
      .bonus-dot.shield { background:#4b72e8; }
      @media(max-width:700px) {
        .bonus-status { top:78px; left:12px; bottom:auto; max-width:calc(100vw - 24px); font-size:9px; gap:6px; }
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

  // Prepare existing pickups before the base collision loop so powerups are never obstacles.
  prepareBonusItems(this);
  collectBonusesBeforeCollision(this);
  ORIGINALS.step.call(this, dt);

  // The base step can spawn new pickups at the far end; classify them immediately afterward.
  prepareBonusItems(this);
  collectBonusesBeforeCollision(this);
  if (this.mode !== 'playing') return;

  const now = this.stats.time as number;
  if (state.magnetUntil > now) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type !== 'coin') continue;
      const dz = item.mesh.position.z - 1.2;
      if (dz < -120 || dz > 3) continue;
      const pull = Math.min(1, dt * 9);
      // Do not filter by lane: every ordinary coin on all three lanes is attracted.
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
