import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;

const originalBuildPrototypes = proto.buildPrototypes;
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  if (this.prototypes.has('river')) return;

  const river = new T.Group();
  const dark = new T.MeshStandardMaterial({ color: '#20282a', roughness: .92 });
  const water = new T.MeshStandardMaterial({ color: '#28545b', roughness: .2, metalness: .08 });
  const edge = new T.MeshStandardMaterial({ color: '#8a806a', roughness: 1 });

  // Actual chasm: the road surface is interrupted and the center drops well below it.
  const depth = new T.Mesh(new T.BoxGeometry(6.7, 2.5, 3.6), dark);
  depth.position.y = -1.15;
  depth.receiveShadow = true;
  river.add(depth);

  const riverWater = new T.Mesh(new T.BoxGeometry(5.95, .06, 3.05), water);
  riverWater.position.y = -1.72;
  river.add(riverWater);

  // Broken stone lips make the opening immediately readable from the approach.
  for (const x of [-3.28, 3.28]) {
    const lip = new T.Mesh(new T.BoxGeometry(.34, .18, 3.72), edge);
    lip.position.set(x, .02, 0);
    lip.rotation.z = x < 0 ? -.08 : .08;
    lip.castShadow = true;
    lip.receiveShadow = true;
    river.add(lip);
  }

  // Visible descending inner walls expose the depth instead of looking like a mat.
  for (const x of [-1, 1]) {
    const slope = new T.Mesh(new T.BoxGeometry(2.75, .9, 3.08), edge);
    slope.position.set(x * 1.9, -.58, 0);
    slope.rotation.z = x < 0 ? -.28 : .28;
    slope.receiveShadow = true;
    river.add(slope);
  }

  const flowMat = new T.MeshBasicMaterial({ color: '#78a9a5', transparent: true, opacity: .5 });
  for (let i = 0; i < 4; i++) {
    const streak = new T.Mesh(new T.BoxGeometry(.9 + (i % 2) * .5, .014, .035), flowMat);
    streak.position.set(-1.9 + i * 1.25, -1.67, i % 2 ? .42 : -.42);
    river.add(streak);
  }

  this.prototypes.set('river', river);
  this.resources.push(river);
};

const originalAddItem = proto.addItem;
proto.addItem = function (type: string, lane: number, z: number) {
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

  if (rowBefore % 3 === 0 && rowBefore % 4 !== 3) {
    const block = [...(this.items || [])].find((item: any) => item.type === 'block' && Math.abs(item.mesh.position.z + 80) < 1.5);
    if (block) this.addItem('coin-orange', block.lane, -80);
  }

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
  this.addItem('coin-orange', 0, riverZ).mesh.position.y = 2.05;
};

const originalStep = proto.step;
proto.step = function (dt: number) {
  const riverBefore = new Set<any>();
  for (const item of ((this.items || []) as any[])) {
    if (item?.checked) riverBefore.add(item);
  }

  originalStep.call(this, dt);

  if (this.mode !== 'playing') return;
  for (const item of ((this.items || []) as any[])) {
    if (item.type !== 'river' || !item.checked || riverBefore.has(item)) continue;
    // The chasm spans all three lanes. It is safe only while airborne.
    if (this.jump < .55) {
      this.die();
      return;
    }
  }
};
