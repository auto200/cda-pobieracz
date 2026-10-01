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

/**
 * Limits `fn` to at most one call per `waitMs`: the first call runs immediately, later ones
 * collapse into a single trailing call carrying the newest value. The trailing call is what lets a
 * stream that finishes mid-interval still paint its final value.
 */
export function throttleValue(fn: (value: number) => void, waitMs: number) {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: number | undefined;

  return (value: number) => {
    const wait = waitMs - (Date.now() - lastRun);

    if (wait <= 0) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = latest = undefined;
      }
      lastRun = Date.now();
      fn(value);
      return;
    }

    latest = value;

    timer ??= setTimeout(() => {
      timer = undefined;
      lastRun = Date.now();
      if (latest !== undefined) {
        fn(latest);
        latest = undefined;
      }
    }, wait);
  };
}

export function getHighestBandwidth<T extends { bandwidth: number }>(
  representations: readonly T[],
): T | undefined {
  return representations.reduce<T | undefined>(
    (best, rep) => (best === undefined || best.bandwidth < rep.bandwidth ? rep : best),
    undefined,
  );
}

export async function downloadToMemory(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}${response.statusText && ` ${response.statusText}`}`);
  }

  if (!response.body) {
    throw new Error("response has no readable body");
  }

  const declaredLength = Number(response.headers.get("Content-Length"));
  const lengthKnown = Number.isFinite(declaredLength) && declaredLength > 0;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    chunks.push(value);
    received += value.byteLength;

    if (lengthKnown) {
      onProgress?.(Math.min(received / declaredLength, 1));
    }
  }

  if (lengthKnown && received !== declaredLength) {
    throw new Error(`incomplete download, received ${received} of ${declaredLength} bytes`);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress?.(1);
  return bytes;
}
