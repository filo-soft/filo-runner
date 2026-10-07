import * as T from "three";
import { RunnerGame } from "./game";

// Restore a clear blue sky after the cinematic pipeline initializes the scene.
const gameProto = RunnerGame.prototype as any;
const originalBuildWorld = gameProto.buildWorld;
gameProto.buildWorld = function () {
  originalBuildWorld.call(this);
  this.scene.background = new T.Color("#8fc4df");
};

// Lightweight film grain overlay: subtle, animated, and above the 3D scene without blocking UI/input.
let grainCanvas: HTMLCanvasElement | null = null;
let grainTimer = 0;

const paintGrain = () => {
  if (!grainCanvas) return;
  const ctx = grainCanvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(grainCanvas.width, grainCanvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = 105 + Math.random() * 150;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
};

const mountGrain = () => {
  if (grainCanvas) return;
  grainCanvas = document.createElement("canvas");
  grainCanvas.width = 160;
  grainCanvas.height = 90;
  grainCanvas.className = "filo-film-grain";
  Object.assign(grainCanvas.style, {
    position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh",
    zIndex: "40", pointerEvents: "none", opacity: "0.045",
    mixBlendMode: "soft-light", imageRendering: "pixelated"
  });
  document.body.appendChild(grainCanvas);
  paintGrain();
  grainTimer = window.setInterval(paintGrain, 110);
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountGrain, { once: true });
else mountGrain();

window.addEventListener("beforeunload", () => { if (grainTimer) window.clearInterval(grainTimer); });
