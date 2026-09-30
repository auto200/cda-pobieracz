export function getBestResolution(qualities: Record<string, string>) {
  let resolutions = Object.keys(qualities)
    .filter((key) => key.endsWith("p") && !Number.isNaN(Number.parseInt(key.slice(0, -1))))
    .map((q) => Number.parseInt(q));

  let bestResolution = qualities[Object.keys(qualities)[0] as string] as string;
  if (resolutions.length) {
    bestResolution = qualities[Math.max(...resolutions) + "p"] as string;
  }

  return bestResolution;
}

export function isNotNullable<T>(val: T | null | undefined): val is T {
  return val !== undefined && val !== null;
}

export function getHighestBandwidth<T extends { bandwidth: number }>(
  representations: readonly T[],
): T | undefined {
  return representations.reduce<T | undefined>(
    (best, rep) => (best === undefined || best.bandwidth < rep.bandwidth ? rep : best),
    undefined,
  );
}
