// ─────────────────────────────────────────────────────────────────────────────
// Shrinks a camera/gallery photo before it is uploaded for diagnosis.
//
// Phone cameras produce 3000-4000 px photos of 1-3 MB. The server's models all
// work at 224-640 px, so that detail is thrown away after a slow upload over
// field mobile data. Measured on real uploads, a 1600 px copy is 3-13x smaller
// and changes the server's class probabilities by at most a few points.
//
// expo-image-manipulator is a native module, so it is loaded defensively (as in
// src/ml/leafModel.ts): on a build that doesn't include it yet, the original
// photo is uploaded unchanged.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_UPLOAD_EDGE = 1600;

let imageManipulator: typeof import('expo-image-manipulator') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  imageManipulator = require('expo-image-manipulator');
} catch {
  imageManipulator = null;
}

export interface UploadImage {
  uri: string;
  name: string;
  type: string;
}

export async function prepareImageForUpload(
  uri: string,
  name: string,
  width: number,
  height: number,
): Promise<UploadImage> {
  const original: UploadImage = { uri, name, type: 'image/jpeg' };
  if (!imageManipulator) return original;
  try {
    const { ImageManipulator, SaveFormat } = imageManipulator;
    let w = width;
    let h = height;
    if (!w || !h) {
      // The picker didn't report dimensions; measure them.
      const probe = await ImageManipulator.manipulate(uri).renderAsync();
      w = probe.width;
      h = probe.height;
    }
    if (Math.max(w, h) <= MAX_UPLOAD_EDGE) return original;

    const context = ImageManipulator.manipulate(uri);
    context.resize(w >= h ? { width: MAX_UPLOAD_EDGE } : { height: MAX_UPLOAD_EDGE });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    return { uri: saved.uri, name: `leaf_${Date.now()}.jpg`, type: 'image/jpeg' };
  } catch {
    return original;
  }
}
