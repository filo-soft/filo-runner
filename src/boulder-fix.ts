import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const BOULDER_INTERVAL = 90;
const BOULDER_START_Z = -98;
const BOULDER_SPEED = 27;
const BOULDER_RADIUS = 1.45;
const BOULDER_VISIBLE_Z = -92;
const BOULDER_HIT_REACH = 2.9;

const makeMarbleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#eeeae0';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11; i++) {
    c.beginPath();
    c.moveTo(-20, 18 + i * 25);
    for (let x = 0; x <= 290; x += 10) {
      const y = 18 + i * 25 + Math.sin(x * .045 + i * 1.7) * 8 + Math.sin(x * .013 + i) * 14;
      c.lineTo(x, y);
    }
    c.strokeStyle = i % 3 === 0 ? '#77756f38' : '#a3a09930';
    c.lineWidth = i % 3 === 0 ? 1.4 : .8;
    c.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
};

const originalBuildPrototypes = proto.buildPrototypes;
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  if (this.prototypes.has('boulder')) return;

  const boulder = new T.Group();
  const marbleMat = new T.MeshStandardMaterial({
    color: '#f1eee5', map: makeMarbleTexture(), roughness: .38, metalness: .02,
  });
  const rock = new T.Mesh(new T.IcosahedronGeometry(BOULDER_RADIUS, 2), marbleMat);
  rock.scale.set(1, .92, 1.05);
  rock.castShadow = true;
  rock.receiveShadow = true;
  boulder.add(rock);

  // An asymmetric marble seam makes the rolling motion unmistakable instead of
  // looking like a sphere that only spins in place.
  const seamMat = new T.MeshStandardMaterial({ color: '#7e7a72', roughness: .48, metalness: .01 });
  const seam = new T.Mesh(new T.TorusGeometry(1.01, .028, 7, 32), seamMat);
  seam.rotation.set(Math.PI * .5, .42, .18);
  seam.scale.set(1.02, .76, 1);
  boulder.add(seam);

  const seam2 = new T.Mesh(new T.TorusGeometry(.73, .022, 7, 28), seamMat);
  seam2.rotation.set(1.08, -.65, .42);
  seam2.scale.set(.92, .78, 1.08);
  boulder.add(seam2);

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
  game.__boulderDustAt = 0;
  return boulder;
}

function destroyOnBoulder(game: any, lane: number, z: number) {
  const items = (game.items || []) as any[];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || item.lane !== lane) continue;
    const type = item.type;
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin', 'bonusCoin'].includes(type)) continue;
    if (Math.abs(Number(item.mesh?.position?.z) - z) > 3.1) continue;
    const pos = item.mesh.position.clone();
    game.burst(pos, true, type === 'coin' || type === 'bonusCoin' ? 5 : 14);
    if (type !== 'coin' && type !== 'bonusCoin') game.burst(pos, true, 7);
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
    return originalStep.call(this, dt);
  }

  originalStep.call(this, dt);
  if (this.mode !== 'playing' || !boulder) return;

  if (!this.__boulderActive && this.stats.time >= this.__boulderNextAt) {
    this.__boulderActive = true;
    this.__boulderLane = Math.floor(Math.random() * 3) - 1;
    this.__boulderZ = BOULDER_START_Z;
    this.__boulderDustAt = 0;
    boulder.visible = true;
    boulder.position.set(
      this.__boulderLane * 2.2 + this.bendOff(BOULDER_START_Z),
      this.groundY + BOULDER_RADIUS - .05,
      BOULDER_START_Z,
    );
    boulder.rotation.set(0, 0, 0);
    this.onToast('КАТИТСЯ ВАЛУН!');
    this.tone(95, .45, 45, 'triangle');
  }
  if (!this.__boulderActive) return;

  const lane = this.__boulderLane as number;
  const prevZ = this.__boulderZ as number;

  // Game world scrolls toward the player (+Z). The boulder gets its own
  // substantially faster +Z velocity, so it physically catches up to us.
  const z = prevZ + BOULDER_SPEED * dt;
  this.__boulderZ = z;

  boulder.position.x = lane * 2.2 + this.bendOff(z);
  boulder.position.y = this.groundY + BOULDER_RADIUS - .05;
  boulder.position.z = z;

  // Roll around the actual transverse axle. The asymmetric seams provide a clear
  // visual reference for the rotation while the whole object advances down-lane.
  const roll = BOULDER_SPEED * dt / BOULDER_RADIUS;
  boulder.rotation.x -= roll;
  boulder.rotation.z += roll * .035;

  // Break anything in the boulder's swept path. Also use a forward reach so an
  // obstacle cannot visually sit inside the boulder before the collision check fires.
  const items = (this.items || []) as any[];
  for (const item of [...items]) {
    if (!item || item.lane !== lane) continue;
    const type = item.type;
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin', 'bonusCoin'].includes(type)) continue;
    const itemZ = Number(item.mesh?.position?.z);
    if (!Number.isFinite(itemZ)) continue;
    const crossed = prevZ <= itemZ && itemZ <= z + BOULDER_HIT_REACH;
    const nearFront = itemZ >= z - .8 && itemZ <= z + BOULDER_HIT_REACH;
    if (crossed || nearFront) destroyOnBoulder(this, lane, itemZ);
  }

  // Dust trail reinforces that the boulder is travelling, not spinning in place.
  this.__boulderDustAt -= dt;
  if (this.__boulderDustAt <= 0) {
    this.__boulderDustAt = .055;
    const dustPos = new T.Vector3(boulder.position.x, this.groundY + .08, z - BOULDER_RADIUS * .65);
    this.burst(dustPos, true, 2);
  }

  if (z > 15) {
    boulder.visible = false;
    this.__boulderActive = false;
    this.__boulderNextAt = this.stats.time + BOULDER_INTERVAL;
  } else if (z >= BOULDER_VISIBLE_Z) {
    boulder.visible = true;
  }
};