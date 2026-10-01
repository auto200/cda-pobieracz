import type { AudioRepresentation, VideoRepresentation } from "./types";

const isNumericQuality = (key: string) =>
  key.endsWith("p") && !Number.isNaN(Number.parseInt(key.slice(0, -1), 10));

const qualityValue = (key: string) => Number.parseInt(key.slice(0, -1), 10);

/**
 * Picks the highest vertical resolution, falling back to the first listed quality when none of the
 * keys is numeric (for example a lone `auto`). Returns undefined when there are no qualities at
 * all, which callers must handle rather than assume away.
 */
export function getBestResolution(qualities: Record<string, string>): string | undefined {
  const [first] = Object.keys(qualities);

  if (first === undefined) {
    return undefined;
  }

  const numeric = Object.keys(qualities).filter(isNumericQuality);

  if (numeric.length === 0) {
    return qualities[first];
  }

  const best = numeric.reduce((a, b) => (qualityValue(a) >= qualityValue(b) ? a : b));

  return qualities[best];
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

/**
 * Picks the loudest audio, which is the one carrying the highest bandwidth. Audio has no dimensions
 * to compare, so bandwidth is the only signal available. Returns undefined when there is no audio
 * at all.
 */
export function getBestAudio(
  representations: AudioRepresentation[],
): AudioRepresentation | undefined {
  return representations.reduce<AudioRepresentation | undefined>(
    (best, rep) => (best === undefined || best.bandwidth < rep.bandwidth ? rep : best),
    undefined,
  );
}

/**
 * Picks the tallest video, breaking ties between equally tall videos by bandwidth. Bandwidth alone
 * would be wrong here: a shorter stream is often encoded at a higher bitrate than a taller one.
 * Returns undefined when there are no videos at all.
 */
export function getBestVideo(
  representations: VideoRepresentation[],
): VideoRepresentation | undefined {
  return representations.reduce<VideoRepresentation | undefined>((best, rep) => {
    if (best === undefined || rep.height > best.height) {
      return rep;
    }

    return rep.height === best.height && rep.bandwidth > best.bandwidth ? rep : best;
  }, undefined);
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
    // oxlint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // oxlint-disable-next-line typescript/no-unnecessary-condition
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
