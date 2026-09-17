import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalSpawn = proto.spawn;
const originalStep = proto.step;
const originalStart = proto.start;
const originalBuildPrototypes = proto.buildPrototypes;
const originalSupportAt = proto.supportAt;
const originalControl = proto.control;

const BONUS_START_TIME = 180;
// spawn() runs roughly every 2 seconds; keep the requested 1% test chance,
// while the active-bonus/world checks and cooldown prevent consecutive bonuses.
const BONUS_CHANCE = .01;
const BONUS_COOLDOWN = 30;
// Magnet remains implemented for a later re-enable and developer test mode,
// but is intentionally excluded from normal gameplay in the stable balance.