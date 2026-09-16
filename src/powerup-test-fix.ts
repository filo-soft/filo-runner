import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalStep = proto.step;

function makeTestVisual(item: any, type: 'magnet' | 'shield') {
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
    const arc = new T.Mesh(new T.TorusGeometry(.22, .09, 8, 18, Math.PI), material); arc.rotation.z = Math.PI; arc.position.y = .34; root.add(arc);
    const tip1 = new T.Mesh(new T.BoxGeometry(.22, .16, .22), material); tip1.position.set(-.22, -.2, 0); root.add(tip1);
    const tip2 = new T.Mesh(new T.BoxGeometry(.22, .16, .22), material); tip2.position.set(.22, -.2, 0); root.add(tip2);
  } else {
    const shape = new T.Shape();
    shape.moveTo(0, .42); shape.lineTo(.36, .18); shape.lineTo(.28, -.18); shape.lineTo(0, -.42); shape.lineTo(-.28, -.18); shape.lineTo(-.36, .18); shape.closePath();
    const shield = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2 }), material);
    shield.position.z = -.065; root.add(shield);
  }
  root.add(new T.Mesh(new T.SphereGeometry(.62, 16, 12), glow));
  root.userData.bonusType = type;
  root.userData.bonusVisual = true;
  root.userData.bonusVisualType = type;
}

proto.spawnTestPowerup = function (type: 'magnet' | 'shield') {
  if (this.mode !== 'playing') return;
  const lane = this.lane as number;
  const z = -22;
  const item = this.addItem('bonusCoin', lane, z);
  item.lane = lane;
  item.laneX = lane * 2.2;
  item.mesh.position.x = item.laneX + this.bendOff(z);
  item.mesh.position.y = this.groundY + this.jump + .9;
  item.checked = true;
  item.mesh.userData.bonusType = type;
  item.mesh.userData.bonusPhase = 'powerup';
  delete item.mesh.userData.bonusVisual;
  makeTestVisual(item, type);
  this.onToast(type === 'shield' ? 'Тестовый щит' : 'Тестовый магнит');
};

proto.launchTestBoulder = function () {
  if (this.mode !== 'playing') return;
  this.__boulderActive = false;
  this.__boulderNextAt = 0;
  this.onToast('Тестовый валун');
};

function forceCollectPowerups(game: any) {
  if (game.mode !== 'playing') return;
  const state = game.__bonusRamp;
  if (!state) return;
  const now = game.stats.time as number;
  for (let i = game.items.length - 1; i >= 0; i--) {
    const item = game.items[i];
    if (item.type !== 'bonusCoin') continue;
    const type = item.mesh.userData.bonusType as 'magnet' | 'shield' | undefined;
    if (!type) continue;
    const close = Math.abs(item.mesh.position.z - 1.2) < 1.45
      && Math.abs(item.mesh.position.x - game.runner.position.x) < 1.45
      && Math.abs(item.mesh.position.y - (game.groundY + game.jump + .9)) < 1.7;
    if (!close) continue;
    game.recycle(item);
    game.items.splice(i, 1);
    if (state.magnetUntil > now || state.shieldUntil > now) continue;
    if (type === 'magnet') state.magnetUntil = now + 15;
    else state.shieldUntil = now + 15;
    game.onToast(type === 'magnet' ? 'Магнит активирован · 15 секунд' : 'Щит активирован · 15 секунд');
    game.tone(type === 'magnet' ? 520 : 360, .15, type === 'magnet' ? 980 : 760);
    game.burst(new T.Vector3(game.runner.position.x, game.groundY + .9, 1.2), false, 14);
    for (let j = game.items.length - 1; j >= 0; j--) {
      const queued = game.items[j];
      if (queued.type === 'bonusCoin' && queued.mesh.userData.bonusType) {
        game.recycle(queued); game.items.splice(j, 1);
      }
    }
    break;
  }
}

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  forceCollectPowerups(this);
};
