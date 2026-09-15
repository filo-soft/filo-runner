import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;

const makeLogoTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2457a6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Geometric brand mark inspired by the current ЖЕЛЕЗНО identity: a compact
  // square emblem followed by the wordmark, without the city name.
  ctx.fillStyle = '#f2eee2';
  ctx.fillRect(46, 48, 224, 224);
  ctx.strokeStyle = '#2457a6';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(82, 232); ctx.lineTo(82, 88); ctx.lineTo(212, 88);
  ctx.moveTo(82, 160); ctx.lineTo(212, 160);
  ctx.moveTo(82, 232); ctx.lineTo(212, 88);
  ctx.stroke();

  ctx.fillStyle = '#f2eee2';
  ctx.font = '900 152px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ЖЕЛЕЗНО', 320, 164);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const addBrandSign = (gate: T.Group) => {
  if (gate.userData.zheleznoRoofSign) return;
  const texture = makeLogoTexture();
  if (!texture) return;

  const sign = new T.Group();
  sign.name = 'ZheleznoRoofSign';
  // The runner passes beneath this exact gate, so keep the branding attached
  // to its roof rather than to the distant sanctuary or side landmarks.
  sign.position.set(0, 8.05, .22);
  sign.rotation.set(0, 0, 0);
  sign.scale.setScalar(.66);

  const backing = new T.Mesh(
    new T.BoxGeometry(5.75, 1.62, .18),
    new T.MeshStandardMaterial({ color: '#ed8b2d', roughness: .62 })
  );
  backing.castShadow = true;
  backing.receiveShadow = true;
  sign.add(backing);

  const panel = new T.Mesh(
    new T.PlaneGeometry(5.45, 1.42),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide })
  );
  panel.position.z = .105;
  sign.add(panel);

  gate.add(sign);
  gate.userData.zheleznoRoofSign = true;
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (gate) addBrandSign(gate);
};
