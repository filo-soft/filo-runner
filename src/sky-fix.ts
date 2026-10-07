import * as T from "three";
import distantBackground from "./assets/distant-greece.svg?url";
import { RunnerGame } from "./game";

type Cloud = { root: T.Group; speed: number; drift: number; minX: number; maxX: number };
const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStep = proto.step;

const makeCloud = (scene: T.Scene, index: number): Cloud => {
  const root = new T.Group();
  root.name = `SkyCloud_${index}`;
  // Volumetric 3D clouds only: soft outer ellipsoids plus denser inner puffs.
  const softMaterial = new T.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: .09, depthWrite: false });
  const coreMaterial = new T.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: false, opacity: 1, depthWrite: false });
  const softGeo = new T.SphereGeometry(1, 18, 12);
  const puffGeo = new T.SphereGeometry(1, 16, 10);
  const count = 5 + index % 3;
  // Larger low-opacity ellipsoids soften the silhouette while staying fully 3D.
  for (let i = 0; i < 3; i++) {
    const haze = new T.Mesh(softGeo, softMaterial);
    const a = i * 2.1 + index * .63;
    haze.position.set((i - 1) * 1.15 + Math.sin(a) * .22, Math.sin(a * 1.4) * .16, .38 + Math.cos(a) * .18);
    const s = 1.05 + (i % 2) * .18;
    haze.scale.set(s * 1.75, s * .72, s * .96);
    root.add(haze);
  }
  for (let i = 0; i < count; i++) {
    const puff = new T.Mesh(puffGeo, coreMaterial);
    const a = i * 1.73 + index * .41;
    puff.position.set((i - (count - 1) / 2) * .95 + Math.sin(a) * .35, Math.sin(a * 1.7) * .22, Math.cos(a) * .35);
    const s = .72 + ((i + index) % 4) * .18;
    puff.scale.set(s * 1.35, s * .55, s * .82);
    root.add(puff);
  }
  root.position.set(-48 + (index * 17) % 96, 15 + (index % 4) * 3.1, -24 - (index * 11) % 74);
  root.scale.setScalar(.9 + (index % 3) * .24);
  root.userData.cloudMaterial = coreMaterial;
  root.userData.cloudSoftMaterial = softMaterial;
  scene.add(root);
  return { root, speed: .55 + (index % 4) * .16, drift: .018 + (index % 3) * .008, minX: -68, maxX: 68 };
};

const addSky = (game: any) => {
  if (game.__skyBackground) return;
  const scene = game.scene as T.Scene;
  scene.background = new T.Color("#8fc4df");
  const texture = new T.TextureLoader().load(distantBackground);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  // Extra-wide backdrop so wide desktop viewports never expose blue side edges.
  const sky = new T.Mesh(new T.PlaneGeometry(360, 203), new T.MeshBasicMaterial({ map: texture, depthTest: false, depthWrite: false, fog: false }));
  sky.name = "DistantGreekBackground";
  sky.position.set(0, -2, -108);
  sky.renderOrder = -100;
  scene.add(sky);
  const clouds: Cloud[] = [];
  for (let i = 0; i < 12; i++) clouds.push(makeCloud(scene, i));
  game.__skyBackground = sky;
  game.__skyClouds = clouds;
};

proto.buildWorld = function () { originalBuildWorld.call(this); addSky(this); };

proto.step = function (dt: number) {
  originalStep.call(this, dt);
  const clouds = (this.__skyClouds || []) as Cloud[];
  if (this.mode !== "paused" && this.mode !== "over") {
    for (const cloud of clouds) {
      cloud.root.position.x += cloud.speed * dt;
      cloud.root.position.z += cloud.drift * dt;
      if (cloud.root.position.x > cloud.maxX) cloud.root.position.x = cloud.minX - 12;
      if (cloud.root.position.z > -15) cloud.root.position.z = -88;
    }
  }
};
const addFilmGrain = () => {
  if (document.querySelector(".filo-film-grain")) return;
  const grain = document.createElement("div");
  grain.className = "filo-film-grain";
  Object.assign(grain.style, {
    position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none",
    opacity: "0.045", mixBlendMode: "soft-light",
    backgroundImage: "radial-gradient(circle at 17% 23%, rgba(255,255,255,.7) 0 1px, transparent 1.5px), radial-gradient(circle at 71% 68%, rgba(0,0,0,.55) 0 1px, transparent 1.5px), radial-gradient(circle at 43% 84%, rgba(255,255,255,.45) 0 1px, transparent 1.3px)",
    backgroundSize: "3px 3px, 5px 5px, 7px 7px",
    animation: "filo-grain-shift .18s steps(2,end) infinite"
  });
  if (!document.getElementById("filo-grain-style")) { const style = document.createElement("style"); style.id = "filo-grain-style"; style.textContent = "@keyframes filo-grain-shift{0%{transform:translate(0,0)}25%{transform:translate(-1px,1px)}50%{transform:translate(1px,-1px)}75%{transform:translate(1px,1px)}100%{transform:translate(0,0)}}"; document.head.appendChild(style); }\n  document.body.appendChild(grain);
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addFilmGrain, { once: true });
else addFilmGrain();
