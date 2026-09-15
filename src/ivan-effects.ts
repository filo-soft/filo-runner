import * as T from 'three';
import { RunnerGame } from './game';

type IvanDebris = {
  mesh: T.Mesh;
  velocity: T.Vector3;
  spin: T.Vector3;
  life: number;
  maxLife: number;
};

type IvanEffectsGame = RunnerGame & {
  __ivanRoot?: T.Group;
  __ivanEffectsReady?: boolean;
  __ivanDebris?: IvanDebris[];
};

const proto = RunnerGame.prototype as any;
const previousStep = proto.step;

const makeBackLabel = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 112px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(25, 20, 60, .9)';
  ctx.lineWidth = 18;
  ctx.strokeText('IVAN', 256, 82);
  ctx.fillStyle = '#f6f1df';
  ctx.fillText('IVAN', 256, 82);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new T.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const label = new T.Mesh(new T.PlaneGeometry(.82, .255), material);
  label.name = 'IvanBackLabel';
  // Runner/IVAN roots face -Z, so the physical back is +Z.
  // The root is rotated 180°, therefore local -Z becomes world +Z.
  label.position.set(0, 1.32, -.385);
  label.rotation.y = Math.PI;
  return label;
};

const ensureIvanLabel = (game: IvanEffectsGame) => {
  const root = game.__ivanRoot;
  if (!root || game.__ivanEffectsReady) return;
  const label = makeBackLabel();
  root.add(label);
  game.__ivanEffectsReady = true;
};

const materialForDebris = (game: IvanEffectsGame, item: any) => {
  let source: T.Material | undefined;
  item?.mesh?.traverse?.((o: T.Object3D) => {
    if (source) return;
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material) source = material;
  });
  const fallback = (game as any).stone as T.MeshStandardMaterial | undefined;
  const base = source || fallback || (game as any).marble;
  return base?.clone ? base.clone() : new T.MeshStandardMaterial({ color: '#d8cbb3', roughness: .9 });
};

const breakObstacle = (game: IvanEffectsGame, item: any, ivanX: number, ivanZ: number) => {
  if (!item?.mesh) return;
  if (item.type === 'coin') return;

  const z = Number(item.mesh.position.z);
  if (!Number.isFinite(z)) return;
  const last = Number(item.mesh.userData.__ivanBreakZ);
  if (Number.isFinite(last) && Math.abs(last - z) < .8) return;
  item.mesh.userData.__ivanBreakZ = z;

  const x = Number(item.mesh.position.x);
  const y = Math.max(.25, Number(item.mesh.position.y) || 0) + .45;
  const amount = item.type === 'wall' || item.type === 'gate' ? 7 : 4;
  const debris = game.__ivanDebris || (game.__ivanDebris = []);
  const material = materialForDebris(game, item);

  for (let i = 0; i < amount; i++) {
    const piece = new T.Mesh(
      new T.BoxGeometry(1, 1, 1),
      material.clone(),
    );
    piece.position.set(
      x + (Math.random() - .5) * 1.15,
      y + (Math.random() - .5) * .55,
      ivanZ + (Math.random() - .5) * .25,
    );
    piece.scale.setScalar(.07 + Math.random() * .11);
    piece.castShadow = true;
    piece.receiveShadow = true;

    const velocity = new T.Vector3(
      (Math.random() - .5) * 1.8 + (x - ivanX) * .08,
      .35 + Math.random() * 1.25,
      .5 + Math.random() * 1.7,
    );
    const spin = new T.Vector3(
      (Math.random() - .5) * 9,
      (Math.random() - .5) * 9,
      (Math.random() - .5) * 9,
    );
    const maxLife = .28 + Math.random() * .22;
    piece.userData.__ivanDebris = true;
    game.scene.add(piece);
    debris.push({ mesh: piece, velocity, spin, life: maxLife, maxLife });
  }
};

const updateDebris = (game: IvanEffectsGame, dt: number) => {
  const debris = game.__ivanDebris;
  if (!debris?.length) return;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    d.velocity.y -= dt * 5.5;
    d.mesh.position.addScaledVector(d.velocity, dt);
    d.mesh.rotation.x += d.spin.x * dt;
    d.mesh.rotation.y += d.spin.y * dt;
    d.mesh.rotation.z += d.spin.z * dt;
    d.mesh.scale.multiplyScalar(Math.max(.88, 1 - dt * 1.8));
    const fade = Math.max(0, d.life / d.maxLife);
    d.mesh.scale.setScalar(Math.max(.015, d.mesh.scale.x * fade));
    if (d.life <= 0) {
      d.mesh.removeFromParent();
      const material = d.mesh.material as T.Material;
      material.dispose();
      d.mesh.geometry.dispose();
      debris.splice(i, 1);
    }
  }
};

proto.step = function (dt: number) {
  const game = this as IvanEffectsGame;
  const rootBefore = game.__ivanRoot;
  const ivanZBefore = rootBefore?.position.z ?? Number.NaN;
  const itemsBefore = game.mode === 'playing'
    ? (((game as any).items || []) as any[]).map(item => ({ item, z: Number(item?.mesh?.position?.z) }))
    : [];

  previousStep.call(this, dt);

  const root = game.__ivanRoot;
  if (!root || game.mode !== 'playing') {
    updateDebris(game, dt);
    return;
  }

  ensureIvanLabel(game);

  const ivanZ = root.position.z;
  const ivanX = root.position.x;
  for (const snapshot of itemsBefore) {
    const item = snapshot.item;
    const prevZ = snapshot.z;
    const nextZ = Number(item?.mesh?.position?.z);
    if (!Number.isFinite(prevZ) || !Number.isFinite(nextZ)) continue;
    if (prevZ < ivanZBefore && nextZ >= ivanZ) {
      if (Math.abs(Number(item.mesh.position.x) - ivanX) < 1.25) {
        breakObstacle(game, item, ivanX, ivanZ);
      }
    }
  }

  updateDebris(game, dt);
};

// Effects module is intentionally imported after ivan.ts so this wrapper is the outermost step layer.
