import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const previousStep = proto.step;
const previousStart = proto.start;

type ZeusState = {
  group: T.Group;
  cloud: T.Group;
  bolt: T.Group;
  active: boolean;
  intro: number;
  grace: number;
  strikeAt: number;
  strikeFlash: number;
};

const makeZeus = (): ZeusState => {
  const group = new T.Group(); group.name = 'PunishingZeus';
  const marble = new T.MeshStandardMaterial({ color: '#eee7d7', roughness: .76 });
  const gold = new T.MeshStandardMaterial({ color: '#c6a45b', roughness: .42, metalness: .38 });
  const dark = new T.MeshStandardMaterial({ color: '#75685d', roughness: .92 });
  const cloudMat = new T.MeshStandardMaterial({ color: '#f1f2ed', roughness: 1 });
  const lightningMat = new T.LineBasicMaterial({ color: '#fff7a8', transparent: true, opacity: .98 });

  const cloud = new T.Group(); cloud.name = 'ZeusCloud';
  const puffs = [[-1.15,0,0,.95],[0,0,.05,1.15],[1.1,0,0,.9],[-.55,.28,.05,.72],[.55,.3,.02,.76]];
  for (const [x,y,z,s] of puffs) {
    const m = new T.Mesh(new T.SphereGeometry(1, 14, 10), cloudMat);
    m.position.set(x,y,z); m.scale.set(s,s*.62,s*.72); m.castShadow=true; cloud.add(m);
  }
  group.add(cloud);

  const body = new T.Group(); body.position.y=.35; group.add(body);
  const torso = new T.Mesh(new T.CylinderGeometry(.48,.68,1.45,18), marble); torso.position.y=.9; torso.castShadow=true; body.add(torso);
  const robe = new T.Mesh(new T.ConeGeometry(.72,1.35,18), marble); robe.position.y=.25; robe.castShadow=true; body.add(robe);
  const head = new T.Group(); head.position.y=1.9; body.add(head);
  const face = new T.Mesh(new T.SphereGeometry(.38,18,14), marble); face.scale.set(.88,1.08,.9); face.castShadow=true; head.add(face);
  const beard = new T.Mesh(new T.ConeGeometry(.29,.58,12), dark); beard.position.set(0,-.32,.18); beard.rotation.x=Math.PI; beard.castShadow=true; head.add(beard);
  const hair = new T.Mesh(new T.SphereGeometry(.41,14,10), dark); hair.scale.set(1,.62,.94); hair.position.y=.18; hair.castShadow=true; head.add(hair);
  const crown = new T.Mesh(new T.TorusGeometry(.4,.045,6,20), gold); crown.rotation.x=Math.PI/2; crown.position.y=.25; head.add(crown);
  for(let i=0;i<7;i++) { const leaf=new T.Mesh(new T.SphereGeometry(.07,8,6),gold); const a=-1.15+i*.38; leaf.position.set(Math.sin(a)*.4,.3+Math.cos(a)*.08,Math.cos(a)*.08); leaf.scale.set(.7,1.5,.5); head.add(leaf); }

  const arm = (x:number, z:number, rot:number) => { const m=new T.Mesh(new T.CapsuleGeometry(.11,.58,4,10),marble); m.position.set(x,1.22,z); m.rotation.z=rot; m.castShadow=true; body.add(m); return m; };
  arm(-.62,.02,-.42); arm(.62,.05,.72);
  const hand=new T.Mesh(new T.SphereGeometry(.15,12,8),marble); hand.position.set(.88,1.7,.05); hand.castShadow=true; body.add(hand);

  const bolt=new T.Group(); bolt.name='ZeusLightning'; bolt.visible=false;
  const makeBolt=(finalStrike:boolean) => {
    bolt.clear();
    const runner=group.userData.runner as T.Group|undefined;
    const sx=.88, sy=2.05, sz=0;
    const tx=runner ? runner.position.x-group.position.x : 0;
    const ty=runner ? runner.position.y+1.0-group.position.y : -3.0;
    const tz=runner ? runner.position.z-group.position.z : 1.2-group.position.z;
    const points:T.Vector3[]=[]; const n=finalStrike?8:7;
    for(let i=0;i<=n;i++) { const t=i/n; points.push(new T.Vector3(T.MathUtils.lerp(sx,tx,t)+(i===0||i===n?0:(Math.random()-.5)*.55),T.MathUtils.lerp(sy,ty,t),T.MathUtils.lerp(sz,tz,t)+(i===0||i===n?0:(Math.random()-.5)*.22))); }
    const line=new T.Line(new T.BufferGeometry().setFromPoints(points),lightningMat); bolt.add(line);
  };
  (bolt as any).__makeBolt=makeBolt; group.add(bolt);
  return { group, cloud, bolt, active:false, intro:0, grace:0, strikeAt:0, strikeFlash:0 };
};

const ensureZeus=(game:any):ZeusState => {
  if(game.__zeus) return game.__zeus as ZeusState;
  const state=makeZeus(); game.__zeus=state; game.scene.add(state.group); state.group.userData.runner=game.runner; state.group.visible=false; return state;
};

const hideZeus=(game:any) => { const z=ensureZeus(game); z.active=false; z.intro=0; z.grace=0; z.strikeFlash=0; z.bolt.visible=false; z.group.visible=false; };
const showZeus=(game:any,intro=false) => { const z=ensureZeus(game); z.active=true; z.intro=intro?3.6:0; z.grace=intro?0:60; z.strikeAt=intro?999:.25; z.strikeFlash=0; z.group.visible=true; z.group.position.set(game.runner.position.x,4.0,intro?-3.5:5.0); z.group.rotation.set(0,0,0); };

const lightning=(game:any,fatal=false) => {
  const z=ensureZeus(game); z.group.userData.runner=game.runner; z.bolt.visible=true; z.strikeFlash=fatal?.32:.18; (z.bolt as any).__makeBolt(fatal);
  game.shake=Math.max(game.shake||0,fatal?.22:.045); game.tone(fatal?95:180,fatal?.38:.16,fatal?28:60,'triangle');
  if(fatal && navigator.vibrate) navigator.vibrate([50,35,90]);
};

const recoverableHit=(game:any,checkedBefore:Set<any>) => {
  for(const item of ((game.items||[]) as any[])) {
    if(!item?.checked || checkedBefore.has(item)) continue;
    if(item.type!=='pillar' && item.type!=='block' && item.type!=='arch') continue;
    const z=Number(item.mesh?.position?.z); if(!Number.isFinite(z)||Math.abs(z-1.2)>.7) continue;
    if(Math.abs(Number(item.mesh?.position?.x||0)-Number(game.runner?.position?.x||0))>.95) continue;
    return item;
  }
  return undefined;
};

proto.start=function() { previousStart.call(this); const game=this as any; showZeus(game,true); game.onToast('Зевс наблюдает за тобой'); };

proto.step=function(dt:number) {
  const game=this as any, wasPlaying=game.mode==='playing', z=ensureZeus(game), checkedBefore=new Set<any>();
  if(wasPlaying) for(const item of ((game.items||[]) as any[])) if(item?.checked) checkedBefore.add(item);
  const activeBefore=z.active && z.grace>0;
  const originalOnOver=game.onOver;
  if(wasPlaying && !activeBefore) game.onOver=(()=>{}) as any;
  try { previousStep.call(this,dt); } finally { game.onOver=originalOnOver; }

  if(wasPlaying && game.mode==='over' && recoverableHit(game,checkedBefore)) {
    if(activeBefore) {
      lightning(game,true); z.active=false; z.grace=0; game.onToast('Карающий Зевс поразил тебя');
      // The original die() already emitted onOver; do not emit it twice.
      return;
    }
    game.mode='playing'; game.shake=Math.max(game.shake||0,.08); showZeus(game,false); game.onToast('Удар выдержан — Зевс карает'); return;
  }

  if(game.mode==='playing') {
    if(z.intro>0) {
      z.intro=Math.max(0,z.intro-dt); z.group.position.x=T.MathUtils.damp(z.group.position.x,game.runner.position.x,7,dt); z.group.position.z=T.MathUtils.damp(z.group.position.z,-2.0,5,dt);
      if(z.intro<=0) hideZeus(game);
    } else if(z.active && z.grace>0) {
      z.grace=Math.max(0,z.grace-dt); const elapsed=60-z.grace, behind=Math.min(7.0,5.0+elapsed*.055);
      z.group.position.x=T.MathUtils.damp(z.group.position.x,game.runner.position.x,8,dt); z.group.position.z=T.MathUtils.damp(z.group.position.z,behind,1.7,dt); z.group.position.y=4.0+Math.sin(game.phase*.8)*.08;
      z.strikeAt-=dt; if(z.strikeAt<=0) { lightning(game,false); z.strikeAt=.85+Math.random()*.75; }
      if(z.grace<=0) hideZeus(game);
    }
  }
  if(z.strikeFlash>0) { z.strikeFlash=Math.max(0,z.strikeFlash-dt); if(z.strikeFlash<=0) z.bolt.visible=false; }
};
