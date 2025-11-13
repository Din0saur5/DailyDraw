const MIN_ASPECT_RATIO = 0.55; // roughly 9:16 portrait
const MAX_ASPECT_RATIO = 1.85; // roughly 16:9 landscape

export const getClampedAspectRatio = (width?: number | null, height?: number | null) => {
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return 1;
  }

  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 1;
  }

  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));
};
