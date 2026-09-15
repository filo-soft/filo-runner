import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalBuildPrototypes = proto.buildPrototypes;

const makeSignTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#214f98';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ed8b2d';
  ctx.lineWidth = 20;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#f6f0df';
  ctx.font = '900 116px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ЖЕЛЕЗНО', canvas.width / 2, 120);
  ctx.fillStyle = '#f1cf9d';
  ctx.font = '700 52px Arial, sans-serif';
  ctx.fillText('КИРОВ', canvas.width / 2, 222);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const addBrandSign = (parent: T.Group, y: number, z: number, scale = 1) => {
  if (parent.userData.zheleznoSign) return;
  const texture = makeSignTexture();
  if (!texture) return;

  const group = new T.Group();
  group.name = 'ZheleznoKirovSign';
  group.position.set(0, y, z);
  group.scale.setScalar(scale);

  const frame = new T.Mesh(
    new T.BoxGeometry(4.9, 1.55, .15),
    new T.MeshStandardMaterial({ color: '#ed8b2d', roughness: .65 })
  );
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const sign = new T.Mesh(
    new T.PlaneGeometry(4.55, 1.28),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide })
  );
  sign.position.z = .085;
  group.add(sign);

  parent.add(group);
  parent.userData.zheleznoSign = true;
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const sideTemple = this.prototypes.get('sideTemple') as T.Group | undefined;
  if (sideTemple) addBrandSign(sideTemple, 6.55, 1.48, .82);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (temple) addBrandSign(temple, 10.15, 3.02, 1.5);
};
