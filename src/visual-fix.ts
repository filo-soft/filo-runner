import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// RunnerGame owns the real render loop. Keep the integration at the renderer boundary,
// but make the visual pass deterministic and idempotent so it cannot be skipped by the game.
const originalRender = T.WebGLRenderer.prototype.render;
const composers = new WeakMap<T.WebGLRenderer, EffectComposer>();
const rendering = new WeakSet<T.WebGLRenderer>();
const preparedScenes = new WeakSet<T.Scene>();
const preparedRenderers = new WeakSet<T.WebGLRenderer>();

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.10 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec2 p=vUv-.5;
      float vignette=1.0-smoothstep(.18,.82,dot(p,p))*amount;
      c.rgb*=vignette;
      c.rgb=mix(c.rgb,c.rgb*vec3(1.022,1.0,.978),.14);
      c.rgb=clamp(c.rgb,0.0,1.0);
      gl_FragColor=c;
    }`
};

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#587792");
  g.addColorStop(.32, "#91aab6");
  g.addColorStop(.64, "#c8bda9");
  g.addColorStop(1, "#ead1aa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function prepareRenderer(renderer: T.WebGLRenderer) {
  if (preparedRenderers.has(renderer)) return;
  preparedRenderers.add(renderer);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.76;
}

function prepareScene(scene: T.Scene) {
  if (preparedScenes.has(scene)) return;
  preparedScenes.add(scene);

  scene.background = makeSkyTexture();
  scene.fog = new T.FogExp2("#c9baa4", 0.0095);

  const lights = scene.children.filter(o => o instanceof T.Light);
  let hemi = lights.find(o => o instanceof T.HemisphereLight) as T.HemisphereLight | undefined;
  if (!hemi) {
    hemi = new T.HemisphereLight("#b8cde2", "#806b55", 0.72);
    scene.add(hemi);
  } else {
    hemi.color.set("#b8cde2");
    hemi.groundColor.set("#806b55");
    hemi.intensity = 0.72;
  }

  let sun = lights.find(o => o instanceof T.DirectionalLight) as T.DirectionalLight | undefined;
  if (!sun) {
    sun = new T.DirectionalLight("#ffdca6", 1.75);
    scene.add(sun);
  }
  sun.color.set("#ffdca6");
  sun.intensity = 1.75;
  sun.position.set(-16, 25, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 36, bottom: -24, near: 1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.028;

  scene.traverse(obj => {
    if (!(obj instanceof T.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.material instanceof T.MeshStandardMaterial) {
      const mat = obj.material;
      mat.metalness = Math.min(mat.metalness, 0.06);
      mat.roughness = Math.max(mat.roughness, 0.74);
      if (mat.color.r > .60 && mat.color.g > .56 && mat.color.b > .48) mat.roughness = Math.max(mat.roughness, .88);
      mat.needsUpdate = true;
    }
  });
}

function upgradeCoins(scene: T.Scene) {
  scene.traverse(obj => {
    if (!(obj instanceof T.Mesh) || !(obj.geometry instanceof T.CylinderGeometry)) return;
    const mat = obj.material;
    if (!(mat instanceof T.MeshStandardMaterial)) return;
    if (mat.color.b < .55 || mat.color.r > .35 || obj.userData.__visualCoin) return;
    obj.userData.__visualCoin = true;
    const physical = new T.MeshPhysicalMaterial({
      color: mat.color.clone(),
      metalness: .82,
      roughness: .17,
      clearcoat: .55,
      clearcoatRoughness: .10,
      emissive: new T.Color("#3155ff"),
      emissiveIntensity: .72,
    });
    obj.material = physical;
    mat.dispose();
  });
}

function getComposer(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) {
  let composer = composers.get(renderer);
  if (composer) return composer;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new T.Vector2(renderer.domElement.width, renderer.domElement.height),
    0.42,
    0.72,
    0.92
  ));
  composer.addPass(new ShaderPass(gradeShader));
  composers.set(renderer, composer);
  return composer;
}

T.WebGLRenderer.prototype.render = function(scene: T.Object3D, camera: T.Camera) {
  const renderer = this;
  if (rendering.has(renderer) || !(scene instanceof T.Scene) || !(camera instanceof T.Camera)) {
    originalRender.call(renderer, scene, camera);
    return;
  }

  prepareRenderer(renderer);
  prepareScene(scene);
  upgradeCoins(scene);

  try {
    const composer = getComposer(renderer, scene, camera);
    composer.setSize(renderer.domElement.width, renderer.domElement.height);
    rendering.add(renderer);
    composer.render();
  } catch (error) {
    console.warn("Filo Runner visual pipeline fallback:", error);
    originalRender.call(renderer, scene, camera);
  } finally {
    rendering.delete(renderer);
  }
};
