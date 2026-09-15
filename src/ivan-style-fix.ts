import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;

const styleIvan = (root: T.Group) => {
  if (root.userData.brandStyled) return;

  const blue = new T.MeshStandardMaterial({ color: '#2457a6', roughness: .68 });
  const blueDark = new T.MeshStandardMaterial({ color: '#173d78', roughness: .78 });
  const orange = new T.MeshStandardMaterial({ color: '#e88b2d', roughness: .62 });
  const white = new T.MeshStandardMaterial({ color: '#f2eee2', roughness: .72 });
  const black = new T.MeshStandardMaterial({ color: '#252b33', roughness: .84 });

  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as T.MeshStandardMaterial;
    if (!material?.color) return;
    const hex = `#${material.color.getHexString()}`.toLowerCase();
    if (hex === '#c7bba4' || hex === '#6f6657') material.color.set(blue.color);
    if (hex === '#4d463d') material.color.set(black.color);
  });

  const torso = root.getObjectByName('IvanRoundedTorso') as T.Group | undefined;
  if (torso) {
    const addCapsule = (x: number, y: number, z: number, radius: number, length: number, mat: T.Material, rotX = 0) => {
      const mesh = new T.Mesh(new T.CapsuleGeometry(radius, length, 6, 14), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rotX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      torso.add(mesh);
      return mesh;
    };
    // Rounded workwear details only — no boxy jacket shell over the body.
    addCapsule(-.17, 1.14, .245, .027, .22, orange);
    addCapsule(.17, 1.14, .245, .027, .22, orange);
    addCapsule(0, .93, .25, .025, .34, white, Math.PI / 2);
    addCapsule(0, .80, .19, .11, .10, blueDark);
  }

  // The back carries Ivan's name, not the company wordmark.
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 360;
  badgeCanvas.height = 120;
  const ctx = badgeCanvas.getContext('2d');
  if (ctx && torso) {
    ctx.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
    ctx.fillStyle = '#f4eee2';
    ctx.font = '900 78px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ИВАН', 180, 58);
    const texture = new T.CanvasTexture(badgeCanvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide, depthWrite: false });
    const badge = new T.Mesh(new T.PlaneGeometry(.58, .19), mat);
    badge.name = 'IvanBackName';
    badge.position.set(0, 1.12, -.31);
    badge.rotation.y = Math.PI;
    torso.add(badge);
  }

  root.userData.brandStyled = true;
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  if (this.__ivanModel) styleIvan(this.__ivanModel as T.Group);
};

const originalStart = proto.start;
proto.start = function () {
  originalStart.call(this);
  if (this.__ivanModel) styleIvan(this.__ivanModel as T.Group);
};
