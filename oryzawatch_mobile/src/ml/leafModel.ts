// ─────────────────────────────────────────────────────────────────────────────
// On-device rice-leaf classifier (offline).
//
// Runs the bundled TensorFlow Lite model (assets/model/rice_leaf.tflite) fully
// offline via react-native-fast-tflite. The backend still computes the
// authoritative diagnosis on upload — this is an instant field estimate for when
// the phone has no signal.
//
// The .tflite graph rescales [0,255] inputs and applies softmax internally, so we
// feed a Float32Array of raw RGB pixels shaped [1, 224, 224, 3] and read back 3
// probabilities in the label order from rice_leaf_labels.json.
//
// The native module is unavailable in Expo Go — every export degrades gracefully
// so the screen keeps working (online-only) there.
// ─────────────────────────────────────────────────────────────────────────────
import labelMap from '../../assets/model/rice_leaf_labels.json';

export type LeafDisease = 'HEALTHY' | 'BLB' | 'BLAST';

export interface LocalDiagnosis {
  disease: LeafDisease;
  confidence: number; // 0..1
  probabilities: Record<LeafDisease, number>;
  source: 'on-device';
}

const INPUT_SIZE = 224;

// Ordered class names, e.g. ["BLB", "HEALTHY", "BLAST"] — index must match the
// model's output vector.
const LABELS: LeafDisease[] = Object.keys(labelMap)
  .sort((a, b) => Number(a) - Number(b))
  .map((k) => (labelMap as Record<string, string>)[k] as LeafDisease);

// ── Lazy native-module handles (absent in Expo Go) ──────────────────────────
let fastTflite: typeof import('react-native-fast-tflite') | null = null;
let nativeLoadError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fastTflite = require('react-native-fast-tflite');
} catch (e: any) {
  nativeLoadError = e?.message ?? 'react-native-fast-tflite is not installed in this build.';
}

export function isOnDeviceAvailable(): boolean {
  return fastTflite != null;
}

export function onDeviceUnavailableReason(): string | null {
  return isOnDeviceAvailable()
    ? null
    : nativeLoadError ??
        'On-device diagnosis needs a development/production build (not Expo Go).';
}

// react-native-fast-tflite v3: run() takes/returns ArrayBuffer[], and
// loadTensorflowModel() takes a required delegates array ([] = CPU).
type TFModel = { run: (inputs: ArrayBuffer[]) => Promise<ArrayBuffer[]> };
let modelPromise: Promise<TFModel> | null = null;

export function loadLeafModel(): Promise<TFModel> {
  if (!fastTflite) {
    return Promise.reject(new Error(onDeviceUnavailableReason() ?? 'unavailable'));
  }
  if (!modelPromise) {
    modelPromise = fastTflite
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      .loadTensorflowModel(require('../../assets/model/rice_leaf.tflite'), [])
      .then((m: any) => m as TFModel)
      .catch((e: any) => {
        modelPromise = null; // allow a later retry
        throw e;
      });
  }
  return modelPromise;
}

/** Warm the model so the first real scan is fast. Safe to call anywhere. */
export function warmUpLeafModel(): void {
  if (isOnDeviceAvailable()) {
    loadLeafModel().catch(() => undefined);
  }
}

// ── Preprocessing ──────────────────────────────────────────────────────────
function decodeAndResize(base64Jpeg: string): Float32Array {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jpeg = require('jpeg-js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { decode: b64ToArrayBuffer } = require('base64-arraybuffer');

  const raw = jpeg.decode(b64ToArrayBuffer(base64Jpeg), { useTArray: true }) as {
    width: number;
    height: number;
    data: Uint8Array; // RGBA
  };

  const { width, height, data } = raw;
  const out = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  // Nearest-neighbour resize straight into the NHWC RGB tensor.
  for (let y = 0; y < INPUT_SIZE; y++) {
    const srcY = Math.min(height - 1, (y * height) / INPUT_SIZE) | 0;
    for (let x = 0; x < INPUT_SIZE; x++) {
      const srcX = Math.min(width - 1, (x * width) / INPUT_SIZE) | 0;
      const src = (srcY * width + srcX) * 4;
      const dst = (y * INPUT_SIZE + x) * 3;
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
    }
  }
  return out;
}

/**
 * Classify a JPEG (base64, no data: prefix — pass ImagePicker asset `.base64`).
 * Throws if on-device inference is unavailable; check isOnDeviceAvailable() first.
 */
export async function classifyLeafFromBase64(base64Jpeg: string): Promise<LocalDiagnosis> {
  const model = await loadLeafModel();
  const input = decodeAndResize(base64Jpeg); // Float32Array, owns its buffer (offset 0)
  const outputs = await model.run([input.buffer as ArrayBuffer]);
  const probs = Array.from(new Float32Array(outputs[0]));

  let best = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[best]) best = i;
  }
  const probabilities = {} as Record<LeafDisease, number>;
  LABELS.forEach((name, i) => {
    probabilities[name] = probs[i] ?? 0;
  });

  return {
    disease: LABELS[best],
    confidence: probs[best] ?? 0,
    probabilities,
    source: 'on-device',
  };
}
