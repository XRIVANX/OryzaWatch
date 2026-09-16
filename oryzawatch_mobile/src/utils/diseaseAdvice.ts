// ─────────────────────────────────────────────────────────────────────────────
// Disease guidance shown with a scan result. Severity and spread wording match
// the web dashboard's ScanResultCard (oryzawatch_frontend/src/utils/helpers.ts),
// so a farmer sees the same assessment on both. Treatment text is the fuller
// field advice this app already gave in its report prompt.
// Not a substitute for an Agri-Kagawad inspection or label-rate chemical advice.
// ─────────────────────────────────────────────────────────────────────────────
import { COLORS } from './constants';

export interface DiseaseGuidance {
  color: string;
  severity: string;
  treatment: string;
  spread: string;
}

const GUIDANCE: Record<string, DiseaseGuidance> = {
  BLB: {
    color: COLORS.danger,
    severity: 'Critical (Level 4)',
    treatment:
      'Drain the paddy and keep water levels low. Stop nitrogen top-dressing until it slows. Pull out and burn badly infected hills and bund weeds. A copper-based bactericide can slow spread but will not cure it.',
    spread: 'Spreads fast through wind-driven rain and irrigation water.',
  },
  BLAST: {
    color: COLORS.warning,
    severity: 'High (Level 3)',
    treatment:
      'Keep the field flooded — never let it dry out — and hold off on nitrogen fertiliser. Apply a recommended fungicide (e.g. tricyclazole) at first sign, repeating after 7–10 days if the weather stays wet. Clear infected stubble after harvest.',
    spread: 'Airborne fungal spores, most active in humid weather.',
  },
  BROWN_SPOT: {
    color: COLORS.goldLight,
    severity: 'Moderate (Level 2)',
    treatment:
      'Usually a nutrient-stress sign: correct potassium and micronutrient deficiency and improve drainage. Use a protectant fungicide (e.g. mancozeb) if lesions spread to the flag leaf, and remove infected debris.',
    spread: 'Nutrient-deficient paddy patches are most at risk.',
  },
  HEALTHY: {
    color: COLORS.success,
    severity: 'Monitoring (Level 1)',
    treatment: 'No disease detected. Keep scouting the field regularly and scan any leaf that develops spots or yellowing.',
    spread: 'Normal baseline surveillance.',
  },
};

const UNKNOWN: DiseaseGuidance = {
  color: COLORS.primary,
  severity: 'Needs inspection',
  treatment:
    'Isolate the affected area, avoid moving water, soil or tools from it to healthy plots, and inspect daily. Ask your Agri-Kagawad for a field inspection and variety-specific guidance.',
  spread: 'Unknown — report it so the MAO can assess.',
};

export const diseaseGuidance = (disease: string): DiseaseGuidance => GUIDANCE[disease] ?? UNKNOWN;
