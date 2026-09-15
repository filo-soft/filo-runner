import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;
const originalDie = proto.die;

const IVAN_MODEL_URL = `${import.meta.env.BASE_URL}ivan/ivan1.glb`;
const IVAN_RUN_URL = `${import.meta.env.BASE_URL}ivan/Slow%20Run1.glb`;

const findClip = (clips: T.AnimationClip[]) =>
  clips.find((clip) => /run|jog|sprint|walk/i.test(clip.name)) ?? clips[0];

const addIvanName = (root: T.Object3D) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 92px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4eee0';
  ctx.strokeStyle = '#463d32';
  ctx.lineWidth = 12;
  ctx.strokeText('ИВАН', 256, 72);
  ctx.fillText('ИВАН', 256, 72);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new T.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const badge = new T.Mesh(new T.PlaneGeometry(.86, .24), material);
  badge.position.set(0, 1.35, .24);
  root.add(badge);
};

const normalizeIvan = (root: T.Object3D) => {
  const box = new T.Box3().setFromObject(root);
  const size = box.getSize(new T.Vector3());
  if (size.y > 0) {
    const scale = 2.0 / size.y;
    root.scale.setScalar(scale);
    const normalized = new T.Box3().setFromObject(root);
    root.position.y -= normalized.min.y;
  }

  // Mixamo characters are commonly authored facing the opposite direction
  // from the runner. Keep Ivan upright and facing the same way as the player.
  root.rotation.y = Math.PI;

  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Do not let a GLB bounding box/frustum decision make the chaser vanish
      // while he is deliberately kept close to the camera.
      mesh.frustumCulled = false;
    }
  });

  root.frustumCulled = false;
  root.renderOrder = 20;
  addIvanName(root);
};

const loadIvan = function () {
  if (this.__ivanLoaded || this.__ivanLoading) return;
  this.__ivanLoading = true;
  const loader = new GLTFLoader();
  loader.load(
    IVAN_MODEL_URL,
    (gltf) => {
      this.__ivanLoaded = true;
      this.__ivanLoading = false;
      this.__ivanModel = gltf.scene;
      normalizeIvan(this.__ivanModel);
      this.__ivanMixer = new T.AnimationMixer(this.__ivanModel);
      loadIvanRun.call(this);

      // If the first hit happened before the model finished loading, put Ivan
      // into the already-running chase immediately.
      if (this.__ivanChase) attachIvan.call(this);
    },
    undefined,
    (error) => {
      this.__ivanLoading = false;
      console.warn('[Filo Runner] Ivan model failed to load:', error);
    },
  );
};

const loadIvanRun = function () {
  if (this.__ivanRunLoaded || this.__ivanRunLoading) return;
  this.__ivanRunLoading = true;
  const loader = new GLTFLoader();
  loader.load(
    IVAN_RUN_URL,
    (gltf) => {
      this.__ivanRunLoaded = true;
      this.__ivanRunLoading = false;
      this.__ivanClips = gltf.animations;
      playRun.call(this);
    },
    undefined,
    (error) => {
      this.__ivanRunLoading = false;
      console.warn('[Filo Runner] Ivan slow run animation failed to load:', error);
    },
  );
};

const playRun = function () {
  const mixer = this.__ivanMixer as T.AnimationMixer | undefined;
  const clips = (this.__ivanClips as T.AnimationClip[] | undefined) ?? [];
  if (!mixer || !clips.length) return;
  const clip = findClip(clips);
  if (!clip) return;
  if (this.__ivanAction?.getClip() === clip && this.__ivanAction.isRunning()) return;
  this.__ivanAction?.stop();
  this.__ivanAction = mixer.clipAction(clip);
  this.__ivanAction.reset().setLoop(T.LoopRepeat, Infinity).play();
};

const attachIvan = function () {
  if (!this.__ivanModel) return;

  if (!this.__ivanAttached) {
    this.__ivanAttached = true;
    this.scene.add(this.__ivanModel);
    this.__ivanModel.visible = true;
    this.__ivanModel.position.set(this.runner.position.x, 0, 5.4);
    this.__ivanModel.updateMatrixWorld(true);
  } else {
    this.__ivanModel.visible = true;
  }

  playRun.call(this);
};

const hideIvan = function () {
  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) model.visible = false;
  this.__ivanChase = false;
  this.__ivanChaseTime = 0;
};

const startIvanChase = function () {
  if (this.mode !== 'playing') return;
  this.__ivanChase = true;
  this.__ivanChaseTime = 0;
  attachIvan.call(this);

  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) {
    model.visible = true;
    model.position.x = this.runner.position.x;
    model.position.y = 0;
    model.position.z = 5.4;
    model.updateMatrixWorld(true);
    playRun.call(this);
  }

  // Strong, unmistakable hit feedback. The run continues with one life lost.
  this.shake = Math.max(this.shake as number, .32);
  this.tone?.(120, .16, 70, 'sawtooth');
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(90);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  loadIvan.call(this);
};

// The first collision costs the single extra life and starts the Ivan chase.
// The next collision is game over, regardless of whether the GLB has finished loading.
proto.die = function () {
  if (this.mode !== 'playing') return originalDie.call(this);

  if (!this.__ivanLifeLost) {
    this.__ivanLifeLost = true;
    startIvanChase.call(this);
    return;
  }

  hideIvan.call(this);
  return originalDie.call(this);
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanLifeLost = false;
  this.__ivanChase = false;
  this.__ivanChaseTime = 0;
  this.__ivanAttached = false;
  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) {
    model.visible = false;
    if (model.parent) model.parent.remove(model);
  }
  loadIvan.call(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);

  const mixer = this.__ivanMixer as T.AnimationMixer | undefined;
  if (mixer && this.mode === 'playing') mixer.update(dt);

  if (!this.__ivanChase || this.mode !== 'playing') return;

  // The model may finish loading after the collision. Attach it as soon as it is ready.
  if (!this.__ivanModel) return;
  attachIvan.call(this);

  const model = this.__ivanModel as T.Object3D;
  this.__ivanChaseTime += dt;
  const t = this.__ivanChaseTime as number;

  // Keep Ivan clearly behind the player, but inside the camera's useful view.
  // Do not reset his position every frame: he should visibly run toward the player.
  const targetZ = Math.max(2.8, 5.4 - t * 0.42);
  model.position.z = T.MathUtils.damp(model.position.z, targetZ, 7, dt);
  model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 12, dt);
  model.position.y = 0;

  if (t >= 7.8 || model.position.z <= 2.75) hideIvan.call(this);
};
