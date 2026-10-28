type Triple = readonly [number, number, number];

/** Fit an authored model inside the existing collision envelope without distorting it. */
export function fitAssetBounds(min: Triple, max: Triple, target: Triple) {
  const size = max.map((value, axis) => value - min[axis]);
  if (![...min, ...max, ...target].every(Number.isFinite) || target.some(value => value <= 0) || size.some(value => value <= 0)) {
    throw new Error("The asset has invalid bounds.");
  }
  return {
    scale: Math.min(...target.map((value, axis) => value / size[axis])),
    offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2] as [number, number, number],
  };
}
