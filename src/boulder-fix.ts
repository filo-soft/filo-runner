import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const BOULDER_INTERVAL = 90;
const BOULDER_START_Z = -108;
const BOULDER_SPEED_BONUS = 11;
const BOULDER_RADIUS = 1.45;

const originalBuildPrototypes = proto.buildPrototypes;
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  if (this.prototypes.has('boulder')) return;

  const boulder = new T.Group();
  const rockMat = new T.MeshStandardMaterial({
    color: '#6f6659',
    roughness: .95,
    metalness: .02,
  });
  const rock = new T.Mesh(new T.IcosahedronGeometry(BOULDER_RADIUS, 1), rockMat);
  rock.scale.set(1, .92, 1.05);
  rock.castShadow = true;
  rock.receiveShadow = true;
  boulder.add(rock);

  // A few shallow stone ridges make the silhouette read as a rough rolling rock.
  const ridgeMat = new T.MeshStandardMaterial({ color: '#514a40', roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const ridge = new T.Mesh(new T.TorusGeometry(.72 + (i % 2) * .08, .035, 5, 9), ridgeMat);
    ridge.rotation.set(Math.PI * .5 + (i - 2) * .11, i * .55, i * .31);
    ridge.scale.set(1.05, .82, 1);
    boulder.add(ridge);
  }

  this.prototypes.set('boulder', boulder);
  this.resources.push(boulder);
};

function ensureBoulder(game: any) {
  if (game.__boulderGroup) return game.__boulderGroup;
  const prototype = game.prototypes.get('boulder') as T.Group | undefined;
  if (!prototype) return undefined;
  const boulder = prototype.clone(true);
  boulder.visible = false;
  game.scene.add(boulder);
  game.__boulderGroup = boulder;
  game.__boulderLane = 0;
  game.__boulderZ = BOULDER_START_Z;
  game.__boulderActive = false;
  game.__boulderNextAt = BOULDER_INTERVAL;
  return boulder;
}

function destroyOnBoulder(game: any, lane: number, z: number) {
  const items = (game.items || []) as any[];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || item.lane !== lane) continue;
    const type = item.type;
    // Everything that occupies the lane is cleared by the boulder: obstacles,
    // platform/stair walls, gates, and coins.
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin'].includes(type)) continue;
    if (Math.abs(item.mesh.position.z - z) > 1.8) continue;

    const pos = item.mesh.position.clone();
    game.burst(pos, true, type === 'coin' ? 4 : 10);
    if (type !== 'coin') game.burst(pos, true, 5);
    game.recycle(item);
    items.splice(i, 1);
  }
}

const originalStep = proto.step;
proto.step = function (dt: number) {
  const wasPlaying = this.mode === 'playing';
  const boulder = ensureBoulder(this);

  if (!wasPlaying && this.mode !== 'playing') {
    if (boulder) boulder.visible = false;
    this.__boulderActive = false;
    this.__boulderNextAt = BOULDER_INTERVAL;
  }

  originalStep.call(this, dt);

  if (this.mode !== 'playing' || !boulder) return;

  // Start a new 90-second cycle exactly once per interval.
  if (!this.__boulderActive && this.stats.time >= this.__boulderNextAt) {
    this.__boulderActive = true;
    this.__boulderLane = Math.floor(Math.random() * 3) - 1;
    this.__boulderZ = BOULDER_START_Z;
    boulder.visible = true;
    boulder.position.set(
      this.__boulderLane * 2.2 + this.bendOff(this.__boulderZ),
      this.groundY + BOULDER_RADIUS - .05,
      this.__boulderZ,
    );
    boulder.rotation.set(0, 0, 0);
    this.onToast('КАТИТСЯ ВАЛУН!');
    this.tone(95, .45, 45, 'triangle');
  }

  if (!this.__boulderActive) return;

  const speed = Math.min(21, 10.5 + this.stats.time * .12) + BOULDER_SPEED_BONUS;
  const prevZ = this.__boulderZ as number;
  this.__boulderZ += speed * dt;
  const z = this.__boulderZ as number;
  const lane = this.__boulderLane as number;

  boulder.position.x = lane * 2.2 + this.bendOff(z);
  boulder.position.y = this.groundY + BOULDER_RADIUS - .05;
  boulder.position.z = z;
  boulder.rotation.x -= speed * dt / BOULDER_RADIUS;
  boulder.rotation.z += speed * dt * .08;

  const items = (this.items || []) as any[];
  for (const item of items) {
    if (!item || item.lane !== lane) continue;
    const type = item.type;
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin'].includes(type)) continue;
    const itemZ = Number(item.mesh?.position?.z);
    if (!Number.isFinite(itemZ)) continue;
    const crossed = prevZ <= itemZ && z >= itemZ;
    if (crossed || Math.abs(itemZ - z) < 1.25) destroyOnBoulder(this, lane, z);
  }

  if (z > 16) {
    boulder.visible = false;
    this.__boulderActive = false;
    this.__boulderNextAt = this.stats.time + BOULDER_INTERVAL;
  }
};
