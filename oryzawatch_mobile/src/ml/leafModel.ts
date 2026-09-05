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

// The model only knows HEALTHY/BLB/BLAST - it has no "other" class, so anything
// (a face, a wall, a document) still gets forced into one of those three labels.
// Mirrors diagnostics/ai.py's _looks_like_leaf (same threshold, same green-
// dominant heuristic) so on-device and server behavior agree.
const MIN_VEGETATION_RATIO = 0.03;

export class NotALeafError extends Error {
  constructor() {
    super("This doesn't look like a rice leaf. Please take a clear photo of a rice leaf.");
    this.name = 'NotALeafError';
  }
}

/** Fraction of pixels that read as green-dominant (vegetation), 0..1. */
function vegetationRatio(rgbPixels: Float32Array): number {
  const pixelCount = rgbPixels.length / 3;
  let vegetationCount = 0;
  for (let i = 0; i < pixelCount; i++) {
    const r = rgbPixels[i * 3];
    const g = rgbPixels[i * 3 + 1];
    const b = rgbPixels[i * 3 + 2];
    if (g > r + 8 && g > b + 8) vegetationCount++;
  }
  return vegetationCount / pixelCount;
}

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

// ── Fast native resize (optional) ────────────────────────────────────────────
// expo-image-manipulator is a native module: it's only present once the dev
// client/APK has been rebuilt to include it, same as react-native-fast-tflite
// above. Load it the same defensive way so an older, not-yet-rebuilt install
// keeps working (just without the speed-up) instead of crashing.
let imageManipulator: typeof import('expo-image-manipulator') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  imageManipulator = require('expo-image-manipulator');
} catch {
  imageManipulator = null;
}

/** Resize a photo URI to the model's own input size natively (fast). Returns
 * `null` (never throws) if expo-image-manipulator isn't linked into this
 * build yet, so callers can fall back to a slower path. */
async function fastResizeToBase64(uri: string): Promise<string | null> {
  if (!imageManipulator) return null;
  try {
    const context = imageManipulator.ImageManipulator.manipulate(uri);
    context.resize({ width: INPUT_SIZE, height: INPUT_SIZE });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: imageManipulator.SaveFormat.JPEG,
      base64: true,
      compress: 0.85,
    });
    return result.base64 ?? null;
  } catch {
    return null;
  }
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
  const input = decodeAndResize(base64Jpeg); // Float32Array, owns its buffer (offset 0)
  if (vegetationRatio(input) < MIN_VEGETATION_RATIO) {
    throw new NotALeafError();
  }

  const model = await loadLeafModel();
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

/**
 * Classify a leaf photo by file URI. Camera/gallery photos come back at full
 * resolution (often 3000x4000+), and decoding that in pure JS (decodeAndResize
 * above) is slow — this resizes to the model's 224x224 input natively first
 * when possible. Pass `fallbackBase64` (e.g. ImagePicker's own `base64: true`
 * output) to still work on a build that hasn't been rebuilt with the native
 * resize module yet - just without the speed-up.
 */
export async function classifyLeafFromUri(
  uri: string,
  fallbackBase64?: string | null,
): Promise<LocalDiagnosis> {
  const base64 = (await fastResizeToBase64(uri)) ?? fallbackBase64;
  if (!base64) {
    throw new Error('Could not prepare the photo for on-device analysis.');
  }
  return classifyLeafFromBase64(base64);
}
