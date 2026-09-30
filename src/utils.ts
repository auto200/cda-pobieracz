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
