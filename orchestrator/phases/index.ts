import type { ReplayXPhaseDefinition } from "../types.js";
import { challengerValidationPhase } from "./challenger-validation.js";
import { diagnosisArenaPhase } from "./diagnosis-arena.js";
import { fixArenaPhase } from "./fix-arena.js";
import { incidentIntakePhase } from "./incident-intake.js";
import { postmortemAndSkillPhase } from "./postmortem-and-skill.js";
import { reproPhase } from "./repro.js";
import { reviewAndRegressionPhase } from "./review-and-regression.js";
import { skillMatchPhase } from "./skill-match.js";

export const replayXPhases: ReplayXPhaseDefinition[] = [
  incidentIntakePhase,
  skillMatchPhase,
  reproPhase,
  diagnosisArenaPhase,
  challengerValidationPhase,
  fixArenaPhase,
  reviewAndRegressionPhase,
  postmortemAndSkillPhase
];
