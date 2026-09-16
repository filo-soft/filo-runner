import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const BOULDER_INTERVAL = 90;
const BOULDER_START_Z = -108;
const BOULDER_SPEED_BONUS = 11;
const BOULDER_RADIUS = 1.45;

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
  const marbleMap = makeMarbleTexture();
  const marbleMat = new T.MeshStandardMaterial({ color: '#f1eee5', map: marbleMap, roughness: .38, metalness: .02 });
  const rock = new T.Mesh(new T.IcosahedronGeometry(BOULDER_RADIUS, 2), marbleMat);
  rock.scale.set(1, .92, 1.05);
  rock.castShadow = true;
  rock.receiveShadow = true;
  boulder.add(rock);

  const accentMat = new T.MeshStandardMaterial({ color: '#c8c4ba', roughness: .3, metalness: .03 });
  for (let i = 0; i < 3; i++) {
    const accent = new T.Mesh(new T.TorusGeometry(.84 + i * .06, .018, 6, 20), accentMat);
    accent.rotation.set(Math.PI * .5 + i * .19, i * .75, i * .28);
    accent.scale.set(1.03, .8, 1);
    boulder.add(accent);
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
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin', 'bonusCoin'].includes(type)) continue;
    if (Math.abs(item.mesh.position.z - z) > 1.8) continue;
    const pos = item.mesh.position.clone();
    game.burst(pos, true, type === 'coin' || type === 'bonusCoin' ? 4 : 10);
    if (type !== 'coin' && type !== 'bonusCoin') game.burst(pos, true, 5);
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

  if (!this.__boulderActive && this.stats.time >= this.__boulderNextAt) {
    this.__boulderActive = true;
    this.__boulderLane = Math.floor(Math.random() * 3) - 1;
    this.__boulderZ = BOULDER_START_Z;
    boulder.visible = true;
    boulder.position.set(this.__boulderLane * 2.2 + this.bendOff(this.__boulderZ), this.groundY + BOULDER_RADIUS - .05, this.__boulderZ);
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
    if (!['block', 'pillar', 'arch', 'wall', 'gate', 'coin', 'bonusCoin'].includes(type)) continue;
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
