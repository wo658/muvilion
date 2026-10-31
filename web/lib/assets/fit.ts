type Triple = readonly [number, number, number];

/** Match all three measured bounds. Reject aspect-ratio changes instead of shrinking to fit. */
export function fitAssetBounds(min: Triple, max: Triple, target: Triple) {
  const size = max.map((value, axis) => value - min[axis]);
  if (![...min, ...max, ...target].every(Number.isFinite) || target.some(value => value <= 0) || size.some(value => value <= 0)) {
    throw new Error("The asset has invalid bounds.");
  }
  const scale = target.map((value, axis) => value / size[axis]) as [number, number, number];
  const uniform = [...scale].sort((a,b) => a-b)[1];
  if (target.some((value, axis) => Math.abs(value - size[axis] * uniform) > 0.005)) throw new Error("Model proportions do not match the physical envelope.");
  return {
    scale,
    offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2] as [number, number, number],
  };
}
