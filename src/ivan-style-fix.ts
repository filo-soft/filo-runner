import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;

const addBox = (parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
  const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const addSphere = (parent: T.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 12), mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const styleIvan = (root: T.Group) => {
  if (root.userData.brandStyled) return;

  const blue = new T.MeshStandardMaterial({ color: '#2457a6', roughness: .68, metalness: .02 });
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
    if (hex === '#c7bba4' || hex === '#6f6657') material.color.set('#2457a6');
    if (hex === '#4d463d') material.color.set('#252b33');
  });

  const leftLeg = root.userData.leftLeg as T.Group | undefined;
  const rightLeg = root.userData.rightLeg as T.Group | undefined;
  if (leftLeg && rightLeg) {
    [leftLeg, rightLeg].forEach((leg) => {
      addBox(leg, 0, -.22, .015, .19, .34, .2, blueDark);
      addBox(leg, 0, -.52, .13, .24, .075, .4, black);
      addBox(leg, 0, -.495, -.05, .23, .055, .24, orange);
    });
  }

  const leftArm = root.userData.leftArm as T.Group | undefined;
  const rightArm = root.userData.rightArm as T.Group | undefined;
  [leftArm, rightArm].forEach((arm) => {
    if (!arm) return;
    addBox(arm, 0, -.25, .015, .18, .36, .17, blue);
    addBox(arm, 0, -.445, 0, .15, .09, .15, white);
  });

  const jacket = new T.Group();
  jacket.name = 'IvanWorkwearDetail';
  root.add(jacket);
  addBox(jacket, 0, 1.06, .205, .61, .64, .035, blue);
  addBox(jacket, 0, 1.385, .225, .5, .045, .04, orange);
  addBox(jacket, -.19, 1.11, .228, .16, .14, .035, blueDark);
  addBox(jacket, .19, 1.11, .228, .16, .14, .035, blueDark);
  addBox(jacket, 0, .87, .205, .64, .06, .04, orange);
  addBox(jacket, 0, .99, .228, .035, .46, .025, white);

  // No company wordmark on Ivan's front. Put his name clearly on the back.
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 320;
  badgeCanvas.height = 120;
  const ctx = badgeCanvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
    ctx.fillStyle = '#f4eee2';
    ctx.font = '900 78px Arial Black, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ИВАН', 160, 58);
    const texture = new T.CanvasTexture(badgeCanvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide, depthWrite: false });
    const badge = new T.Mesh(new T.PlaneGeometry(.54, .2), mat);
    badge.position.set(0, 1.16, -.255);
    badge.rotation.y = Math.PI;
    jacket.add(badge);
  }

  const helmet = new T.Group();
  helmet.name = 'IvanHelmetDetail';
  root.add(helmet);
  addSphere(helmet, 0, 2.01, 0, .33, .13, .3, orange);
  const brim = new T.Mesh(new T.CylinderGeometry(.39, .39, .075, 28), orange);
  brim.position.set(0, 1.91, 0);
  brim.castShadow = true;
  brim.receiveShadow = true;
  helmet.add(brim);
  addBox(helmet, 0, 2.02, .08, .06, .17, .34, orange);
  addBox(helmet, -.2, 1.97, 0, .05, .11, .32, orange);
  addBox(helmet, .2, 1.97, 0, .05, .11, .32, orange);
  addSphere(helmet, 0, 1.99, -.12, .2, .06, .1, blueDark);
  addBox(helmet, 0, 1.905, .28, .25, .045, .04, black);
  const headlamp = new T.Mesh(new T.CylinderGeometry(.055, .055, .025, 16), white);
  headlamp.rotation.x = Math.PI / 2;
  headlamp.position.set(0, 2.02, .325);
  headlamp.castShadow = true;
  helmet.add(headlamp);

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
