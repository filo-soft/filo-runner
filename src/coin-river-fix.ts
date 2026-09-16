import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;

// Add the new all-lanes river/chasm prototype without touching the core runner.
const originalBuildPrototypes = proto.buildPrototypes;
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  if (this.prototypes.has('river')) return;

  const river = new T.Group();
  const water = new T.Mesh(
    new T.BoxGeometry(6.65, .055, 3.35),
    new T.MeshStandardMaterial({ color: '#315f68', roughness: .28, metalness: .08 })
  );
  water.position.y = .055;
  water.receiveShadow = true;
  river.add(water);

  // Uneven dark banks make it read as a narrow rocky fissure rather than a flat platform.
  const bankMat = new T.MeshStandardMaterial({ color: '#756b58', roughness: 1 });
  for (const x of [-3.18, 3.18]) {
    const bank = new T.Mesh(new T.BoxGeometry(.38, .16, 3.55), bankMat);
    bank.position.set(x, .11, 0);
    bank.rotation.z = x < 0 ? -.055 : .055;
    bank.castShadow = true;
    bank.receiveShadow = true;
    river.add(bank);
  }

  // A few pale streaks give the water a visible flow direction.
  const flowMat = new T.MeshBasicMaterial({ color: '#83b0ae', transparent: true, opacity: .48 });
  for (let i = 0; i < 5; i++) {
    const streak = new T.Mesh(new T.BoxGeometry(1.0 + (i % 2) * .55, .012, .045), flowMat);
    streak.position.set(-2.35 + i * 1.12, .091, (i % 2 ? .48 : -.42));
    streak.rotation.y = -.12;
    river.add(streak);
  }

  this.prototypes.set('river', river);
  this.resources.push(river);
};

const originalAddItem = proto.addItem;
proto.addItem = function (type: string, lane: number, z: number) {
  // Orange coins use the normal coin item mechanics, but get a dedicated visual and height.
  if (type === 'coin-orange') {
    const item = originalAddItem.call(this, 'coin', lane, z);
    item.mesh.userData.orangeCoin = true;
    item.mesh.position.y = 2.02;
    item.mesh.traverse((obj: any) => {
      if (!(obj instanceof T.Mesh)) return;
      if (Array.isArray(obj.material)) obj.material = obj.material.map((m: T.Material) => m.clone());
      else if (obj.material) obj.material = obj.material.clone();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats as any[]) {
        if (mat.color) mat.color.set('#f28a24');
        if (mat.emissive) mat.emissive.set('#8a3d08');
        if ('emissiveIntensity' in mat) mat.emissiveIntensity = .16;
      }
    });
    return item;
  }

  const item = originalAddItem.call(this, type, lane, z);
  item.mesh.userData.orangeCoin = false;
  return item;
};

const originalSpawn = proto.spawn;
proto.spawn = function () {
  const rowBefore = this.row as number;
  originalSpawn.call(this);

  // Every sixth regular pattern becomes a river crossing. Avoid the existing wall rows.
  if (rowBefore % 6 !== 2 || rowBefore % 4 === 3) return;

  const riverZ = -80;
  const toRemove = [...(this.items || [])].filter((item: any) =>
    item.type !== 'gate' && item.type !== 'wall' &&
    item.mesh.position.z < -68 && item.mesh.position.z > -91
  );
  for (const item of toRemove) {
    this.recycle(item);
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  const river = this.addItem('river', 0, riverZ);
  river.laneX = 0;
  river.mesh.position.x = this.bendOff(riverZ);
  river.mesh.position.y = .1;

  // A visible orange reward directly above the crossing tells the player to jump.
  this.addItem('coin-orange', 0, riverZ).mesh.position.y = 2.05;
};

const originalStep = proto.step;
proto.step = function (dt: number) {
  const checkedBefore = new Set<any>();
  for (const item of ((this.items || []) as any[])) {
    if (item?.checked) checkedBefore.add(item);
  }

  originalStep.call(this, dt);

  if (this.mode !== 'playing') return;
  for (const item of ((this.items || []) as any[])) {
    if (item.type !== 'river' || !item.checked || checkedBefore.has(item)) continue;
    // River occupies the full width, so lane choice cannot avoid it: only a jump works.
    if (this.jump < .55) {
      this.die();
      return;
    }
    this.burst(new T.Vector3(this.runner.position.x, this.groundY + .15, 1.2), true, 8);
  }
};
