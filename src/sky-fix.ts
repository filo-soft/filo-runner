import * as T from 'three';
import distantBackground from './assets/distant-greece.svg?url';
import { RunnerGame } from './game';

type Cloud = { root: T.Group; speed: number; drift: number; minX: number; maxX: number };
const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStep = proto.step;

const makeCloud = (scene: T.Scene, index: number): Cloud => {
  const root = new T.Group();
  root.name = `SkyCloud_${index}`;
  const material = new T.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    transparent: true,
    opacity: .72,
    depthWrite: false,
  });
  const puffGeo = new T.SphereGeometry(1, 14, 9);
  const count = 5 + index % 3;
  for (let i = 0; i < count; i++) {
    const puff = new T.Mesh(puffGeo, material);
    const a = i * 1.73 + index * .41;
    puff.position.set((i - (count - 1) / 2) * .95 + Math.sin(a) * .35, Math.sin(a * 1.7) * .22, Math.cos(a) * .35);
    const s = .72 + ((i + index) % 4) * .18;
    puff.scale.set(s * 1.35, s * .55, s * .82);
    root.add(puff);
  }
  puffGeo.computeBoundingSphere();
  root.position.set(-48 + (index * 17) % 96, 15 + (index % 4) * 3.1, -24 - (index * 11) % 74);
  root.scale.setScalar(.9 + (index % 3) * .24);
  root.userData.cloudMaterial = material;
  scene.add(root);
  return { root, speed: .55 + (index % 4) * .16, drift: .018 + (index % 3) * .008, minX: -68, maxX: 68 };
};

const addSky = (game: any) => {
  if (game.__skyBackground) return;
  const scene = game.scene as T.Scene;
  const texture = new T.TextureLoader().load(distantBackground);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const sky = new T.Mesh(
    new T.PlaneGeometry(240, 135),
    new T.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, fog: false })
  );
  sky.name = 'DistantGreekBackground';
  sky.position.set(0, -2, -108);
  sky.renderOrder = -100;
  scene.add(sky);
  const clouds: Cloud[] = [];
  for (let i = 0; i < 12; i++) clouds.push(makeCloud(scene, i));
  game.__skyBackground = sky;
  game.__skyClouds = clouds;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  addSky(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const clouds = (this.__skyClouds || []) as Cloud[];
  if (this.mode !== 'paused' && this.mode !== 'over') {
    for (const cloud of clouds) {
      cloud.root.position.x += cloud.speed * dt;
      cloud.root.position.z += cloud.drift * dt;
      if (cloud.root.position.x > cloud.maxX) cloud.root.position.x = cloud.minX - 12;
      if (cloud.root.position.z > -15) cloud.root.position.z = -88;
    }
  }
};