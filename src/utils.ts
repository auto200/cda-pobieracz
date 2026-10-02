import type { AudioRepresentation, VideoRepresentation } from "./types";

const CDA_HOSTNAMES = new Set(["cda.pl", "www.cda.pl"]);

// CDA serves a video page under `/video/{id}`, optionally followed by a variant segment
// such as `/vfilm`.
const CDA_VIDEO_PATH = /^\/video\/([^/]+)/;

/**
 * Returns the video id when the url points at a cda.pl video page, otherwise undefined. The
 * hostname has to match exactly, otherwise a lookalike domain such as `cda.pl.example.com` would
 * pass.
 */
export function getCdaVideoId(url: string): string | undefined {
  const { hostname, pathname } = new URL(url);

  if (!CDA_HOSTNAMES.has(hostname)) {
    return undefined;
  }

  return pathname.match(CDA_VIDEO_PATH)?.[1];
}

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

// Linux and macOS accept everything here except "/" and NUL, so this set is deliberately wider
// than any one platform needs: a name written on a Windows machine has to survive a copy to Linux,
// and macOS reserves a little more than POSIX does.
//
// The control characters are included because they are silently dropped by some filesystems, which
// would leave the saved name differing from what is displayed. They are spelled out rather than
// written as a range so the literal bytes cannot end up in this source file.
// oxlint-disable-next-line no-control-regex
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F\u007F]/g;

// Invisible and bidirectional formatting characters are valid on all three platforms, so nothing
// will stop them arriving here. U+202E reverses how the rest of the name is displayed, which lets
// "invoice\u202Egpj.exe" read as "invoicegpj.exe", and U+FEFF is a stray byte-order mark that
// renders as nothing at all. Zero-width joiners are deliberately excluded from this set: they hold
// emoji sequences together and shape several scripts, so dropping them would mangle titles that
// are perfectly legitimate.
const INVISIBLE_FILENAME_CHARS =
  /[\u00AD\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// Windows reserves these as filenames regardless of any extension, and does so
// case-insensitively. Linux and macOS accept them, but a file created with one of these names
// cannot be opened on Windows, so the prefix keeps the download portable. They only matter as the
// whole stem, which is why "console" and "com10" are deliberately absent.
const RESERVED_FILENAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

// A leading dot hides the file on Linux and macOS instead of naming it, and a trailing one is
// dropped by Windows without warning, so both ends of the stem are stripped of dots.
const HIDDEN_FILENAME_CHARS = /^\.+|\.+$/g;

// ext4, NTFS and APFS all cap a single path component at 255 bytes rather than characters.
const MAX_FILENAME_BYTES = 255;

function decodeTitle(rawTitle: string): string {
  try {
    return decodeURIComponent(rawTitle);
  } catch {
    // A malformed escape sequence is not worth failing a download over: the raw title is still
    // better than nothing, and the sanitising below still applies to it.
    return rawTitle;
  }
}

/**
 * Truncates to a byte budget without splitting a surrogate pair. Iterating the string yields whole
 * code points, so an emoji or a character outside the basic plane stays intact instead of becoming
 * a lone surrogate that encodes to U+FFFD.
 */
function truncateToByteLength(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();

  if (encoder.encode(value).byteLength <= maxBytes) {
    return value;
  }

  let bytes = 0;
  let truncated = "";

  for (const character of value) {
    const size = encoder.encode(character).byteLength;

    if (bytes + size > maxBytes) {
      break;
    }

    bytes += size;
    truncated += character;
  }

  return truncated;
}

/**
 * Turns a video title into a filename that is safe on Windows, macOS and Linux.
 *
 * The three disagree about what is legal: Linux rejects only "/" and NUL, macOS adds the colon and
 * the HFS+ volume names, and Windows rejects a dozen characters, the reserved device names, and
 * trailing dots or spaces. The result is deliberately the strictest of the three rather than the
 * loosest, because a filename is written once and then copied between machines, and being rejected
 * on the machine that receives the file is worse than losing a character on the one that made it.
 *
 * The title arrives percent-encoded, so it is decoded first. Characters no filesystem accepts
 * become single spaces rather than being deleted, which keeps words from running together, and
 * invisible or bidirectional formatting characters are dropped entirely since they carry no visible
 * text. Returns `fallback` when nothing usable is left, so the caller always has a name to write
 * to.
 */
export function toSafeFilename(rawEncodedTitle: string, fallback = "video"): string {
  const sanitized = decodeTitle(rawEncodedTitle)
    // macOS stores filenames in NFD, so two titles differing only in normalisation form land on
    // the same name once written. Composing to NFC first means the byte budget below is measured
    // against what actually gets saved.
    .normalize("NFC")
    .replaceAll(INVISIBLE_FILENAME_CHARS, "")
    .replaceAll(ILLEGAL_FILENAME_CHARS, " ")
    // Collapse the runs of spaces left behind, including any the title already contained.
    .replaceAll(/\s+/g, " ")
    .trim()
    // Trailing dots and spaces are dropped by Windows without warning, so a name ending in either
    // is a name that will not come back the way it went in.
    .replace(/[. ]+$/, "")
    // A leading dot hides the file on Linux and macOS instead of naming it.
    .replace(HIDDEN_FILENAME_CHARS, "");

  if (sanitized === "") {
    return fallback;
  }

  // Truncation can expose a new trailing dot or space, so the strip has to run again afterwards.
  // It cannot empty the string, since the budget is far larger than a single character.
  const truncated = truncateToByteLength(sanitized, MAX_FILENAME_BYTES)
    .trim()
    .replace(HIDDEN_FILENAME_CHARS, "");

  // Prefixing rather than suffixing keeps the reserved word recognisable to the user who typed it.
  return RESERVED_FILENAMES.has(truncated.toLowerCase()) ? `_${truncated}` : truncated;
}

/**
 * Limits `fn` to at most one call per `waitMs`: the first call runs immediately, later ones
 * collapse into a single trailing call carrying the newest value. The trailing call is what lets a
 * stream that finishes mid-interval still paint its final value.
 */
export function throttleValue<T extends unknown[]>(
  fn: (...value: T) => void,
  waitMs: number,
  options?: { staggerFirst: boolean },
) {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: T | undefined;

  return (...value: T) => {
    const wait = waitMs - (Date.now() - lastRun);

    if (wait <= 0) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = latest = undefined;
      }

      if (options?.staggerFirst && lastRun === 0) {
        lastRun = Date.now();
        return;
      }

      lastRun = Date.now();
      fn(...value);
      return;
    }

    latest = value;

    timer ??= setTimeout(() => {
      timer = undefined;
      lastRun = Date.now();
      if (latest !== undefined) {
        const current = latest;
        latest = undefined;
        fn(...current);
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

export type DownloadProgress = {
  received: number;
  total: number | undefined;
  ratio: number;
};

export async function downloadToMemory(
  url: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  if (!response.body) {
    throw new Error("response has no readable body");
  }

  const declaredLength = Number(response.headers.get("Content-Length"));
  const lengthKnown = Number.isFinite(declaredLength) && declaredLength > 0;
  const totalBytes = lengthKnown ? declaredLength : undefined;

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

    const ratio = lengthKnown ? Math.min(received / declaredLength, 1) : 1;

    if (lengthKnown) {
      onProgress?.({ received, total: totalBytes, ratio });
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

  onProgress?.({ received, total: totalBytes, ratio: 1 });
  return bytes;
}
