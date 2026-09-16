import * as T from 'three';
import { RunnerGame } from './game';

type IvanState = 'hidden' | 'retreat' | 'chase';
type IvanGame = RunnerGame & {
  __ivanGuardRoot?: T.Group;
  __ivanGuardState?: IvanState;
  __ivanGuardGap?: number;
  __ivanGuardLaneX?: number;
  __ivanGuardFovTarget?: number;
};

const proto = RunnerGame.prototype as any;
const previousStep = proto.step;
const previousStart = proto.start;
const previousMenu = proto.menu;

const PLAYER_Z = 1.2;
const IVAN_START_GAP = 3.9;
const IVAN_MAX_GAP = 11.5;
const IVAN_RETREAT_SPEED = 1.05;
const IVAN_CHASE_SPEED = 8.2;
const IVAN_CATCH_GAP = 0.72;
const IVAN_FOV_NORMAL = 47;
const IVAN_FOV_IVAN = 54;
const IVAN_CAMERA_RESPONSE = 7;
const IVAN_LANE_RESPONSE = 9;
const IVAN_X_OFFSET = 0.18;
const PHILOSOPHER_CLOTH_HEX = 0xe2ddcf;

const findRecoverableHit = (game: any, checkedBefore: Set<any>) => {
  const items = (game.items || []) as any[];
  const runner = game.runner as any;
  for (const item of items) {
    if (!item?.checked || checkedBefore.has(item)) continue;
    if (item.type !== 'pillar' && item.type !== 'block' && item.type !== 'arch') continue;
    const z = Number(item.mesh?.position?.z);
    if (!Number.isFinite(z) || Math.abs(z - PLAYER_Z) > .7) continue;
    const x = Number(item.mesh?.position?.x || 0);
    if (Math.abs(x - runner.position.x) > .95) continue;
    return item;
  }
  return undefined;
};

const cloneBlueGuard = (game: IvanGame) => {
  if (game.__ivanGuardRoot) return;

  const player = (game as any).runner as T.Group;
  const blue = (game as any).blue as T.MeshStandardMaterial | undefined;
  if (!player || !blue) return;

  const root = player.clone(true);
  root.name = 'IVANGuard';
  root.position.set(player.position.x + IVAN_X_OFFSET, (game as any).groundY, PLAYER_Z + IVAN_START_GAP);
  root.visible = false;

  const guardMeshes: T.Mesh[] = [];
  root.traverse((o: T.Object3D) => { const m = o as T.Mesh; if (m.isMesh) guardMeshes.push(m); });

  // The original philosopher's wreath uses the unique green material. Remove only those meshes.
  for (const mesh of guardMeshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const green = mats.some((mat: any) => {
      const color = mat?.color;
      if (!color) return false;
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      return hsl.h > .18 && hsl.h < .30 && hsl.s > .18 && hsl.l < .7;
    });
    if (green) {
      mesh.removeFromParent();
      continue;
    }

    // Recolor the philosopher's himation only. The marble body/head remain marble.
    const next = mats.map((mat: any) => {
      const color = mat?.color;
      if (!color) return mat;
      if (color.getHex() === PHILOSOPHER_CLOTH_HEX) return blue.clone();
      return mat.clone ? mat.clone() : mat;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  // White IVAN lettering sits on the upper back, facing the camera.
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 94px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('IVAN', 256, 72);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    const label = new T.Mesh(
      new T.PlaneGeometry(.86, .242),
      new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: T.DoubleSide }),
    );
    label.name = 'IVANBackLabel';
    label.position.set(0, 1.75, .285);
    root.add(label);
  }

  (game as any).scene.add(root);
  game.__ivanGuardRoot = root;
};

const collectBones = (root: T.Object3D) => {
  const bones: T.Bone[] = [];
  root.traverse((o: T.Object3D) => { if (o instanceof T.Bone) bones.push(o); });
  return bones;
};

const copyRunningPose = (game: IvanGame) => {
  const root = game.__ivanGuardRoot;
  const player = (game as any).runner as T.Group | undefined;
  if (!root || !player) return;
  const source = collectBones(player);
  const target = collectBones(root);
  const count = Math.min(source.length, target.length);
  for (let i = 0; i < count; i++) {
    target[i].position.copy(source[i].position);
    target[i].quaternion.copy(source[i].quaternion);
    target[i].scale.copy(source[i].scale);
  }
};

const setIvanState = (game: IvanGame, state: IvanState) => {
  game.__ivanGuardState = state;
  if (state === 'hidden') {
    if (game.__ivanGuardRoot) game.__ivanGuardRoot.visible = false;
    game.__ivanGuardGap = IVAN_START_GAP;
    game.__ivanGuardFovTarget = IVAN_FOV_NORMAL;
    return;
  }
  if (game.__ivanGuardRoot) game.__ivanGuardRoot.visible = true;
  game.__ivanGuardFovTarget = IVAN_FOV_IVAN;
};

const startIvan = (game: IvanGame) => {
  cloneBlueGuard(game);
  if (!game.__ivanGuardRoot) return;
  game.__ivanGuardGap = IVAN_START_GAP;
  game.__ivanGuardLaneX = (game as any).runner.position.x + IVAN_X_OFFSET;
  game.__ivanGuardRoot.position.set(game.__ivanGuardLaneX, (game as any).groundY, PLAYER_Z + IVAN_START_GAP);
  setIvanState(game, 'retreat');
};

const updateIvan = (game: IvanGame, dt: number) => {
  const root = game.__ivanGuardRoot;
  const player = (game as any).runner as T.Group;
  if (!root || !player || game.mode !== 'playing') return;

  const state = game.__ivanGuardState || 'hidden';
  if (state === 'hidden') {
    game.__ivanGuardFovTarget = IVAN_FOV_NORMAL;
    return;
  }

  copyRunningPose(game);

  const gap = Number.isFinite(game.__ivanGuardGap) ? game.__ivanGuardGap! : IVAN_START_GAP;
  if (state === 'retreat') {
    game.__ivanGuardGap = Math.min(IVAN_MAX_GAP, gap + IVAN_RETREAT_SPEED * dt);
    if (game.__ivanGuardGap >= IVAN_MAX_GAP) {
      setIvanState(game, 'hidden');
      return;
    }
  } else if (state === 'chase') {
    game.__ivanGuardGap = Math.max(IVAN_CATCH_GAP, gap - IVAN_CHASE_SPEED * dt);
    if (game.__ivanGuardGap <= IVAN_CATCH_GAP) {
      root.visible = false;
      (game as any).die();
      return;
    }
  }

  const desiredX = player.position.x + IVAN_X_OFFSET;
  const currentX = game.__ivanGuardLaneX ?? desiredX;
  const response = state === 'chase' ? IVAN_LANE_RESPONSE * 1.6 : IVAN_LANE_RESPONSE;
  game.__ivanGuardLaneX = T.MathUtils.damp(currentX, desiredX, response, dt);

  // +Z is the camera/player side in this runner, so the chaser stays physically behind
  // the philosopher on the road while remaining visible to the camera.
  const targetZ = player.position.z + game.__ivanGuardGap;
  root.position.x = game.__ivanGuardLaneX;
  root.position.y = (game as any).groundY;
  root.position.z = T.MathUtils.damp(root.position.z, targetZ, IVAN_CAMERA_RESPONSE, dt);
  root.visible = true;

  // Widen the field of view while Ivan is active: the main philosopher becomes visually
  // deeper/smaller and the guard has room to remain clearly visible behind him.
  const camera = (game as any).camera as T.PerspectiveCamera;
  const targetFov = game.__ivanGuardFovTarget ?? IVAN_FOV_IVAN;
  camera.fov = T.MathUtils.damp(camera.fov, targetFov, IVAN_CAMERA_RESPONSE, dt);
  camera.updateProjectionMatrix();
};

proto.start = function () {
  previousStart.call(this);
  const game = this as IvanGame;
  cloneBlueGuard(game);
  setIvanState(game, 'hidden');
  const camera = (game as any).camera as T.PerspectiveCamera;
  camera.fov = IVAN_FOV_NORMAL;
  camera.updateProjectionMatrix();
};

proto.menu = function () {
  previousMenu.call(this);
  setIvanState(this as IvanGame, 'hidden');
};

proto.step = function (dt: number) {
  const game = this as IvanGame;
  const wasPlaying = game.mode === 'playing';
  const checkedBefore = new Set<any>();
  if (wasPlaying) {
    for (const item of (((game as any).items || []) as any[])) {
      if (item?.checked) checkedBefore.add(item);
    }
  }

  previousStep.call(this, dt);

  if (wasPlaying && game.mode === 'playing') {
    const hit = findRecoverableHit(game, checkedBefore);
    if (hit) {
      const state = game.__ivanGuardState || 'hidden';
      if (state === 'retreat') {
        // Second consecutive hit before Ivan has fallen away: turn the warning into a chase.
        setIvanState(game, 'chase');
        game.__ivanGuardGap = Math.max(IVAN_CATCH_GAP, game.__ivanGuardGap ?? IVAN_START_GAP);
        if (game.onToast) game.onToast('Иван догоняет');
      } else if (state === 'hidden') {
        // The existing hit-protection layer has already forgiven this first hit.
        startIvan(game);
      }
    }
  }

  if (game.mode === 'playing') {
    updateIvan(game, dt);
  } else if (game.mode === 'menu' || game.mode === 'paused' || game.mode === 'over') {
    if (game.__ivanGuardState !== 'hidden') setIvanState(game, 'hidden');
    const camera = (game as any).camera as T.PerspectiveCamera;
    camera.fov = T.MathUtils.damp(camera.fov, IVAN_FOV_NORMAL, IVAN_CAMERA_RESPONSE, dt);
    camera.updateProjectionMatrix();
  }
};
