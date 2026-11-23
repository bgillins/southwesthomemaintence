// ------- Photo handling in the browser -------
// Phone cameras produce 4 to 12 MB files. Shrinking them on the phone before
// upload makes them send in a second or two on a weak signal, and keeps
// storage costs small. 1600px on the long edge is plenty for a report.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function shrinkPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  // imageOrientation keeps portrait photos upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Could not process that photo.'))), 'image/jpeg', QUALITY),
  );
  return { blob, width, height };
}
