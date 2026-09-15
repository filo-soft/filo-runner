import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RunnerGame } from './game';

// IVAN tuning: all pursuit balance lives here so it can be adjusted without touching the loop.
const IVAN_BASE_GAP = 14;        // Target distance behind the runner in world-space Z.
const IVAN_INTRO_GAP = 3;        // Starting distance for the short "right behind you" intro.
const IVAN_INTRO_DURATION = 2.2; // Seconds to ease from INTRO_GAP to BASE_GAP.
const IVAN_CATCH_GAP = 0.9;      // Gap at or below this value means IVAN has caught the runner.
const IVAN_HIT_PENALTY = 6;      // Base amount removed from the gap by one hit.
const IVAN_COMBO_MULT = 0.35;    // Escalation multiplier for consecutive hits.
const IVAN_RECOVERY_RATE = 1.4;  // Gap recovery in world units per second without a new hit.
const IVAN_LANE_LAG = 3.2;       // Larger value = slower response to lane changes.
const IVAN_RENDER_GAP_CAP = 8.25;// Camera is on +Z; cap only the rendered position so IVAN stays visible.
const IVAN_MODEL_HEIGHT = 2.45;  // Match the visual height of the existing philosopher.
const IVAN_SCALE_LERP = 10;      // Smooth world-position response.

const PHILOSOPHER_Z = 1.2;
type IvanReason = 'hit' | 'ivan';
type IvanGame = RunnerGame & {
  __ivanRoot?: T.Group;
  __ivanMixer?: T.AnimationMixer;
  __ivanAction?: T.AnimationAction;
  __ivanAnimationsReady?: boolean;
  __ivanGap?: number;
  __ivanComboHits?: number;
  __ivanIntroTimer?: number;
  __ivanLaneX?: number;
  __ivanLoaded?: boolean;
  __ivanLoadFailed?: boolean;
  __ivanReason?: IvanReason;
  __ivanSuppressedOver?: boolean;
};

type GLTF = Awaited<ReturnType<GLTFLoader['loadAsync']>>;

const proto = RunnerGame.prototype as any;
const previousBuildWorld = proto.buildWorld;
const previousStart = proto.start;
const previousMenu = proto.menu;
const previousStep = proto.step;
const previousDie = proto.die;

const getRunner = (game: IvanGame) => (game as any).runner as T.Group;
const getGroundY = (game: IvanGame) => Number((game as any).groundY) || 0;

const getMaterials = (root: T.Object3D) => {
  const materials: T.Material[] = [];
  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material && !materials.includes(material)) materials.push(material);
    }
  });
  return materials;
};

const isNeutralMaterial = (material: T.Material) => {
  const standard = material as T.MeshStandardMaterial;
  if (!standard.color) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  standard.color.getHSL(hsl);
  return hsl.s < .08 && hsl.l > .12 && hsl.l < .95;
};

const applyExistingPaletteIfNeeded = (game: IvanGame, root: T.Group) => {
  const materials = getMaterials(root);
  if (!materials.length || !materials.every(isNeutralMaterial)) return;
  const marble = (game as any).marble as T.MeshStandardMaterial | undefined;
  const blue = (game as any).blue as T.MeshStandardMaterial | undefined;
  if (!marble || !blue) return;

  let meshIndex = 0;
  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const wantsBlue = /(shirt|jacket|suit|tie|pants|trouser|shoe|brief|case|bag|accessory|accent)/i.test(mesh.name);
    const next = (wantsBlue || meshIndex % 5 === 0) ? blue : marble;
    mesh.material = material.map(() => next.clone());
    meshIndex++;
  });
};

const addIvanBadgeIfMissing = (game: IvanGame, root: T.Group) => {
  let alreadyNamed = false;
  root.traverse((object: T.Object3D) => {
    const haystack = `${object.name} ${(object.userData?.name || '')}`.toLowerCase();
    if (haystack.includes('ivan') || haystack.includes('nameplate') || haystack.includes('badge')) alreadyNamed = true;
  });
  if (alreadyNamed) return;

  const marble = (game as any).marble as T.MeshStandardMaterial | undefined;
  const blue = (game as any).blue as T.MeshStandardMaterial | undefined;
  if (!marble || !blue) return;

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${marble.color.getHexString()}`;
  ctx.font = '900 92px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('IVAN', canvas.width / 2, canvas.height / 2 + 2);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const badgeMat = new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide, depthWrite: false });
  badgeMat.userData.brandSource = blue.uuid;
  const badge = new T.Mesh(new T.PlaneGeometry(.82, .23), badgeMat);
  badge.name = 'IVANBadge';
  badge.position.set(0, .96, .29);
  badge.rotation.y = Math.PI;
  root.add(badge);
};

const inspectIvanAsset = (model: T.Object3D, animationGltf: GLTF) => {
  const bones: T.Bone[] = [];
  model.traverse((object: T.Object3D) => { if (object instanceof T.Bone) bones.push(object); });
  console.groupCollapsed('[IVAN] GLB inspection');
  console.log('ivan1.glb bones:', bones.map(b => b.name));
  console.log('Slow Run1.glb animations:', animationGltf.animations.map(a => ({ name: a.name, duration: a.duration })));
  console.log('ivan1.glb materials:', getMaterials(model).map(m => ({ name: m.name, type: m.type, color: (m as T.MeshStandardMaterial).color?.getHexString?.(), map: Boolean((m as T.MeshStandardMaterial).map) })));
  console.groupEnd();
};

const clipTargets = (clip: T.AnimationClip) => {
  const names = new Set<string>();
  for (const track of clip.tracks) names.add(track.name.split('.')[0].split(':')[0]);
  return [...names];
};

const animationCompatible = (model: T.Object3D, clip: T.AnimationClip) => {
  const bones = new Set<string>();
  model.traverse((object: T.Object3D) => { if (object instanceof T.Bone) bones.add(object.name); });
  const targets = clipTargets(clip);
  const missing = targets.filter(name => !bones.has(name));
  return { compatible: missing.length === 0, missing, targets, boneCount: bones.size };
};

const setupIvanAnimation = (game: IvanGame, model: T.Group, animationGltf: GLTF) => {
  inspectIvanAsset(model, animationGltf);
  const clip = animationGltf.animations[0];
  if (!clip) {
    console.warn('[IVAN] Slow Run1.glb contains no animation clips.');
    return;
  }
  const compatibility = animationCompatible(model, clip);
  console.log('[IVAN] animation compatibility:', compatibility);
  if (!compatibility.compatible) {
    console.warn('[IVAN] Animation clip targets do not match ivan1.glb bones. No retargeting was applied.', compatibility);
    return;
  }
  const mixer = new T.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.setLoop(T.LoopRepeat, Infinity);
  action.play();
  game.__ivanMixer = mixer;
  game.__ivanAction = action;
  game.__ivanAnimationsReady = true;
};

const loadIvan = async (game: IvanGame) => {
  if (game.__ivanLoaded || game.__ivanLoadFailed) return;
  game.__ivanLoaded = true;
  const loader = new GLTFLoader();
  try {
    const [modelGltf, animationGltf] = await Promise.all([
      loader.loadAsync('./ivan/ivan1.glb'),
      loader.loadAsync('./ivan/Slow%20Run1.glb'),
    ]);

    const root = new T.Group();
    root.name = 'IvanWorldRoot';
    const model = modelGltf.scene;
    model.name = 'IvanGLBModel';
    root.add(model);

    const box = new T.Box3().setFromObject(model);
    const size = new T.Vector3(); box.getSize(size);
    if (size.y > .01) {
      const scale = IVAN_MODEL_HEIGHT / size.y;
      model.scale.setScalar(scale);
      model.position.y = -box.min.y * scale;
    }

    const runner = getRunner(game);
    root.position.set(runner.position.x, getGroundY(game), runner.position.z + IVAN_INTRO_GAP);
    root.rotation.set(0, Math.PI, 0);
    root.visible = false;
    root.traverse((object: T.Object3D) => {
      const mesh = object as T.Mesh;
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
    });

    applyExistingPaletteIfNeeded(game, root);
    addIvanBadgeIfMissing(game, root);
    setupIvanAnimation(game, model, animationGltf);

    game.scene.add(root);
    game.__ivanRoot = root;
  } catch (error) {
    game.__ivanLoadFailed = true;
    console.error('[IVAN] Failed to load public/ivan GLBs.', error);
  }
};

const resetIvan = (game: IvanGame) => {
  const runner = getRunner(game);
  game.__ivanGap = IVAN_INTRO_GAP;
  game.__ivanComboHits = 0;
  game.__ivanIntroTimer = 0;
  game.__ivanLaneX = runner.position.x;
  game.__ivanReason = undefined;
  if (game.__ivanRoot) {
    game.__ivanRoot.visible = true;
    game.__ivanRoot.position.set(runner.position.x, getGroundY(game), runner.position.z + IVAN_INTRO_GAP);
    game.__ivanRoot.rotation.y = Math.PI;
  }
  if (game.__ivanMixer) game.__ivanMixer.setTime(0);
};

const hideIvan = (game: IvanGame) => {
  if (game.__ivanRoot) game.__ivanRoot.visible = false;
};

const animateIvanWorld = (game: IvanGame, dt: number) => {
  const root = game.__ivanRoot;
  if (!root || !game.__ivanLoaded || game.mode !== 'playing') return;
  const runner = getRunner(game);
  if (game.__ivanMixer) game.__ivanMixer.update(dt);

  const introActive = (game.__ivanComboHits || 0) === 0 && (game.__ivanIntroTimer || 0) < IVAN_INTRO_DURATION;
  game.__ivanIntroTimer = Math.min(IVAN_INTRO_DURATION, (game.__ivanIntroTimer || 0) + dt);
  const introProgress = T.MathUtils.smoothstep(game.__ivanIntroTimer / IVAN_INTRO_DURATION, 0, 1);
  const recoveredGap = Math.min(IVAN_BASE_GAP, (game.__ivanGap ?? IVAN_INTRO_GAP) + IVAN_RECOVERY_RATE * dt);
  game.__ivanGap = recoveredGap;
  if (game.__ivanGap >= IVAN_BASE_GAP) game.__ivanComboHits = 0;

  const desiredLaneX = runner.position.x;
  const currentLaneX = game.__ivanLaneX ?? desiredLaneX;
  game.__ivanLaneX = currentLaneX + ((desiredLaneX - currentLaneX) / IVAN_LANE_LAG) * dt;

  const desiredGap = introActive
    ? T.MathUtils.lerp(IVAN_INTRO_GAP, IVAN_BASE_GAP, introProgress)
    : game.__ivanGap;
  const visibleGap = Math.min(desiredGap, IVAN_RENDER_GAP_CAP);
  const targetZ = runner.position.z + visibleGap;
  root.position.x = T.MathUtils.damp(root.position.x, game.__ivanLaneX, IVAN_SCALE_LERP, dt);
  root.position.y = T.MathUtils.damp(root.position.y, getGroundY(game), IVAN_SCALE_LERP, dt);
  root.position.z = T.MathUtils.damp(root.position.z, targetZ, IVAN_SCALE_LERP, dt);
  root.visible = true;
};

const findFreshCollision = (game: IvanGame, checkedBefore: Set<any>) => {
  const items = (((game as any).items || []) as any[]);
  const runner = getRunner(game);
  let best: any;
  let bestDistance = Infinity;
  for (const item of items) {
    if (!item?.checked || checkedBefore.has(item)) continue;
    if (item.type !== 'pillar' && item.type !== 'block' && item.type !== 'arch') continue;
    const z = Number(item.mesh?.position?.z);
    if (!Number.isFinite(z) || Math.abs(z - PHILOSOPHER_Z) > .55) continue;
    const laneDistance = Math.abs(Number(item.mesh?.position?.x || 0) - runner.position.x);
    if (laneDistance > .95) continue;
    if (Math.abs(z - PHILOSOPHER_Z) < bestDistance) { best = item; bestDistance = Math.abs(z - PHILOSOPHER_Z); }
  }
  return best;
};

const emitGameOver = (game: IvanGame, reason: IvanReason) => {
  game.__ivanReason = reason;
  const callback = game.onOver;
  callback?.({ ...game.stats, __ivanReason: reason } as any);
};

proto.buildWorld = function () {
  previousBuildWorld.call(this);
  void loadIvan(this as IvanGame);
};

proto.menu = function () {
  const game = this as IvanGame;
  previousMenu.call(this);
  resetIvan(game);
  hideIvan(game);
};

proto.start = function () {
  const game = this as IvanGame;
  previousStart.call(this);
  resetIvan(game);
  void loadIvan(game);
};

proto.die = function () {
  return previousDie.call(this);
};

proto.step = function (dt: number) {
  const game = this as IvanGame;
  const wasPlaying = game.mode === 'playing';
  const checkedBefore = new Set<any>();
  if (wasPlaying) {
    for (const item of (((game as any).items || []) as any[])) if (item?.checked) checkedBefore.add(item);
  }

  const originalOnOver = game.onOver;
  if (wasPlaying) {
    game.__ivanSuppressedOver = true;
    game.onOver = (() => {}) as any;
  }

  try {
    previousStep.call(this, dt);
  } finally {
    game.onOver = originalOnOver;
    game.__ivanSuppressedOver = false;
  }

  const collision = wasPlaying && game.mode === 'over' ? findFreshCollision(game, checkedBefore) : null;
  if (collision) {
    game.mode = 'playing';
    const nextCombo = (game.__ivanComboHits || 0) + 1;
    game.__ivanComboHits = nextCombo;
    game.__ivanGap = Math.max(0, (game.__ivanGap ?? IVAN_INTRO_GAP) - IVAN_HIT_PENALTY * (1 + nextCombo * IVAN_COMBO_MULT));

    if ((game.__ivanGap ?? 0) <= IVAN_CATCH_GAP) {
      previousDie.call(this);
      game.mode = 'over';
      emitGameOver(game, 'ivan');
      hideIvan(game);
      return;
    }

    game.__ivanIntroTimer = IVAN_INTRO_DURATION;
  } else if (wasPlaying && game.mode === 'over') {
    emitGameOver(game, 'hit');
    hideIvan(game);
    return;
  }

  if (game.mode === 'playing') animateIvanWorld(game, dt);
  else if (game.mode === 'over' || game.mode === 'menu') hideIvan(game);
};
