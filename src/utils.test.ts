import { describe, expect, test } from "bun:test";

import type { AudioRepresentation, VideoRepresentation } from "./types";
import {
  getBestAudio,
  getBestResolution,
  getBestVideo,
  getCdaVideoId,
  throttleValue,
  toSafeFilename,
} from "./utils";

describe("getCdaVideoId", () => {
  test.each([
    ["https://www.cda.pl/video/13054129d3w", "13054129d3w"],
    ["https://www.cda.pl/video/13054129d3aa/vfilm", "13054129d3aa"],
    ["https://cda.pl/video/13054129d3", "13054129d3"],
    ["https://www.cda.pl/video/13054129d3?fs=0#player", "13054129d3"],
  ])("returns the video id of a video page", (url, expected) => {
    expect(getCdaVideoId(url)).toBe(expected);
  });

  test.each([
    "https://www.cda.pl/",
    "https://www.cda.pl/games/123",
    "https://www.cda.pl/video/",
    "https://www.cda.pl/videoteka",
    "https://www.cda.pl.evil.com/video/13054129d3",
    "https://evil.com/video/13054129d3",
    "https://notcda.pl/video/13054129d3",
    "http://www.cda.pl.evil.com/video/13054129d3",
  ])("returns undefined for %p", (url) => {
    expect(getCdaVideoId(url)).toBeUndefined();
  });
});

describe("getBestResolution", () => {
  test.each([
    [
      {
        "480p": "lq",
        "720p": "md",
        "1080p": "hd",
        auto: "auto",
      },
      "hd",
    ],
    [
      {
        auto: "auto",
      },
      "auto",
    ],
    [
      {
        auto: "auto",
        "1080p": "hd",
      },
      "hd",
    ],
    [
      {
        "9p": "nine",
        "1080p": "hd",
        "480p": "sd",
      },
      "hd",
    ],
    [
      {
        "1080p": "hd",
        "2160p": "uhd",
      },
      "uhd",
    ],
  ])("returns correct quality", (qs, expected) => {
    expect(getBestResolution(qs)).toBe(expected);
  });

  test("returns undefined when there are no qualities", () => {
    expect(getBestResolution({})).toBeUndefined();
  });
});

const audio = (bandwidth: number, baseURL: string): AudioRepresentation => ({
  type: "audio",
  bandwidth,
  baseURL,
  codecs: null,
  mimeType: null,
});

const video = (bandwidth: number, baseURL: string, height = 1080): VideoRepresentation => ({
  type: "video",
  bandwidth,
  baseURL,
  codecs: null,
  mimeType: null,
  width: Math.round((height * 16) / 9),
  height,
});

describe("getBestAudio", () => {
  const stereo = audio(128_000, "audio-stereo.mp4");
  const stereoHigh = audio(192_000, "audio-stereo-high.mp4");
  const surround = audio(256_000, "audio-surround.mp4");
  const quiet = audio(64_000, "audio-quiet.mp4");

  test.each([
    [[stereo, surround], surround],
    [[surround, stereo], surround],
    [[quiet, stereoHigh, stereo], stereoHigh],
    [[stereo], stereo],
  ])("returns the audio with the highest bandwidth", (audios, expected) => {
    expect(getBestAudio(audios)).toBe(expected);
  });

  test("returns undefined for an empty list", () => {
    expect(getBestAudio([])).toBeUndefined();
  });

  test("keeps the first audio when bandwidths are equal", () => {
    const first = audio(1_000_000, "first.mp4");
    const second = audio(1_000_000, "second.mp4");

    expect(getBestAudio([first, second])).toBe(first);
  });

  test("returns audio with zero bandwidth", () => {
    const zero = audio(0, "zero.mp4");

    expect(getBestAudio([zero])).toBe(zero);
  });
});

describe("getBestVideo", () => {
  const hd = video(2_400_000, "video-1080p.mp4", 1080);
  const sd = video(3_000_000, "video-480p.mp4", 480);
  const hdSteady = video(1_500_000, "video-1080p-steady.mp4", 1080);
  const sdSteady = video(500_000, "video-480p-steady.mp4", 480);

  test.each([
    [[hd, sd], hd],
    [[sd, hd], hd],
    [[sd, hd, sdSteady], hd],
    [[hd], hd],
  ])("returns the tallest video regardless of bandwidth", (videos, expected) => {
    expect(getBestVideo(videos)).toBe(expected);
  });

  test("returns the highest bandwidth video among equally tall ones", () => {
    expect(getBestVideo([hdSteady, hd, sd])).toBe(hd);
    expect(getBestVideo([hd, hdSteady, sd])).toBe(hd);
  });

  test("keeps the first video when height and bandwidth are both equal", () => {
    const first = video(1_000_000, "first.mp4", 720);
    const second = video(1_000_000, "second.mp4", 720);

    expect(getBestVideo([first, second])).toBe(first);
  });

  test("falls back to bandwidth when no video declares a height", () => {
    const sized = video(1_000_000, "sized.mp4", 0);
    const alsoSized = video(2_000_000, "also-sized.mp4", 0);

    expect(getBestVideo([sized, alsoSized])).toBe(alsoSized);
  });

  test("returns undefined for an empty list", () => {
    expect(getBestVideo([])).toBeUndefined();
  });
});

describe("toSafeFilename", () => {
  test("decodes a percent-encoded title", () => {
    expect(toSafeFilename("Kr%C3%B3l%20i%20w%20nocy")).toBe("Król i w nocy");
  });

  test("leaves an already-decoded title alone", () => {
    expect(toSafeFilename("Król i w nocy")).toBe("Król i w nocy");
  });

  test("decodes Polish diacritics that percent-encoding splits across bytes", () => {
    expect(toSafeFilename(encodeURIComponent("ł"))).toBe("ł");
  });

  test.each([
    ["a/b", "a b"],
    ["a\\b", "a b"],
    ["a:b", "a b"],
    ["a*b", "a b"],
    ["a?b", "a b"],
    ['a"b', "a b"],
    ["a<b>c", "a b c"],
    ["a|b", "a b"],
  ])("replaces %p with a space rather than deleting it", (title, expected) => {
    expect(toSafeFilename(title)).toBe(expected);
  });

  test("strips control characters", () => {
    expect(toSafeFilename("a\u0000b\u001Fc")).toBe("a b c");
  });

  test("collapses the whitespace runs that replacing characters leaves behind", () => {
    expect(toSafeFilename("a///b")).toBe("a b");
    expect(toSafeFilename("a  \t\n b")).toBe("a b");
  });

  test("trims surrounding whitespace", () => {
    expect(toSafeFilename("  padded  ")).toBe("padded");
  });

  test.each([
    ["trailing.", "trailing"],
    ["trailing...", "trailing"],
    ["trailing ", "trailing"],
    ["trailing. ", "trailing"],
    ["dots.and.dots...", "dots.and.dots"],
  ])("strips trailing dots and spaces from %p", (title, expected) => {
    expect(toSafeFilename(title)).toBe(expected);
  });

  test.each(["con", "CON", "Con", "prn", "aux", "nul", "com1", "com9", "lpt1", "LPT9"])(
    "escapes the windows reserved name %p",
    (title) => {
      expect(toSafeFilename(title)).toBe(`_${title}`);
    },
  );

  test.each(["console", "com0", "com10", "lpt0", "nula", "conman"])(
    "leaves %p alone because it is not reserved",
    (title) => {
      expect(toSafeFilename(title)).toBe(title);
    },
  );

  test("falls back when the title is empty", () => {
    expect(toSafeFilename("")).toBe("video");
  });

  test("falls back when the title is only whitespace", () => {
    expect(toSafeFilename("   \t ")).toBe("video");
  });

  test("falls back when the title is only illegal characters", () => {
    expect(toSafeFilename("///")).toBe("video");
  });

  test("falls back when the title is only dots and spaces", () => {
    expect(toSafeFilename("...  ...")).toBe("video");
  });

  test("honours a caller-supplied fallback", () => {
    expect(toSafeFilename("", "audio")).toBe("audio");
    expect(toSafeFilename("///", "audio")).toBe("audio");
  });

  test("keeps a long title that fits within the byte limit", () => {
    const title = "a".repeat(200);

    expect(toSafeFilename(title)).toBe(title);
  });

  test("truncates a title that exceeds the byte limit", () => {
    const result = toSafeFilename("b".repeat(400));

    expect(result).toHaveLength(255);
  });

  test("measures the limit in bytes rather than characters", () => {
    // Each of these is two bytes in utf-8, so 200 of them is 400 bytes and must be cut to 127.
    const result = toSafeFilename("ł".repeat(200));

    expect(new TextEncoder().encode(result).byteLength).toBeLessThanOrEqual(255);
    expect(result).toHaveLength(127);
  });

  test("does not split a surrogate pair when truncating", () => {
    // Each emoji is four bytes, so 63 fit in the 255-byte budget and 64 would need 256. A split
    // pair would decode to U+FFFD, so asserting the exact repeated run rules that out.
    const result = toSafeFilename("\u{1F600}".repeat(200));

    expect(result).toBe("\u{1F600}".repeat(63));
    expect(result).not.toContain("\uFFFD");
  });

  test("re-strips a trailing space exposed by truncation", () => {
    // 254 filler characters plus a two-byte "ł" plus a trailing space: the space falls off the end
    // of the budget, and the character before it is the space that has to be stripped.
    const result = toSafeFilename(`${"c".repeat(254)}ł `);

    expect(result.endsWith(" ")).toBe(false);
    expect(new TextEncoder().encode(result).byteLength).toBeLessThanOrEqual(255);
  });

  test("truncates on a byte boundary without discarding the character before it", () => {
    // 255 filler bytes exactly fills the budget, so the two-byte "ł" past it is dropped whole.
    const result = toSafeFilename(`${"d".repeat(255)}ł`);

    expect(result).toBe("d".repeat(255));
  });

  test("survives a malformed percent escape", () => {
    expect(toSafeFilename("100% sure %E0%A4%A")).toBe("100% sure %E0%A4%A");
  });

  test("sanitises a malformed title rather than passing it through", () => {
    expect(toSafeFilename("%zz/b")).toBe("%zz b");
  });

  test("leaves a percent sign that is not part of an escape alone", () => {
    expect(toSafeFilename("100% organic")).toBe("100% organic");
  });

  test("strips a leading dot so the file is not hidden", () => {
    expect(toSafeFilename(".hidden")).toBe("hidden");
  });

  test.each([
    ["..two", "two"],
    [".hidden.mp4", "hidden.mp4"],
  ])("strips repeated leading dots from %p", (title, expected) => {
    expect(toSafeFilename(title)).toBe(expected);
  });

  test("keeps dots in the middle of a name", () => {
    expect(toSafeFilename("S01E02.mkv.1080p")).toBe("S01E02.mkv.1080p");
  });

  test("strips a bidirectional override that would reverse how the name reads", () => {
    // Without this, "invoice\u202Egpj.exe" displays as "invoicegpj.exe" while the bytes on disk
    // still spell out the attacker's intent.
    expect(toSafeFilename("invoice\u202Egpj.exe")).toBe("invoicegpj.exe");
  });

  test("strips other bidirectional and invisible formatting characters", () => {
    expect(toSafeFilename("a\u200Eb")).toBe("ab");
    expect(toSafeFilename("a\u200Fb")).toBe("ab");
    expect(toSafeFilename("a\u2066b\u2069")).toBe("ab");
    expect(toSafeFilename("a\u00ADb")).toBe("ab");
    expect(toSafeFilename("\uFEFFtitle")).toBe("title");
  });

  test("keeps a zero-width joiner because emoji sequences depend on it", () => {
    // The joined sequence is one grapheme and would otherwise be torn into three separate ones.
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";

    expect(toSafeFilename(family)).toBe(family);
  });

  test("strips the delete character", () => {
    expect(toSafeFilename("a\u007Fb")).toBe("a b");
  });

  test("normalises a decomposed title so macOS does not store a second copy", () => {
    // macOS keeps filenames in NFD, so a decomposed title and a precomposed one would otherwise
    // become two entries in the download folder.
    const decomposed = "e\u0301tat";
    const precomposed = "\u00E9tat";

    expect(toSafeFilename(decomposed)).toBe(precomposed);
  });

  test("normalising shortens a decomposed title so the byte budget counts real bytes", () => {
    // "e" plus a combining acute is three bytes decomposed and two composed, so 200 of them has
    // to fit within the budget once composed.
    const result = toSafeFilename("e\u0301".repeat(200));

    expect(result).toBe("\u00E9".repeat(127));
  });

  test("still falls back when the title is only invisible characters", () => {
    expect(toSafeFilename("\u202E\u200B\uFEFF")).toBe("video");
  });

  test("still falls back when the title is only leading dots", () => {
    expect(toSafeFilename("...")).toBe("video");
  });

  test("does not decode a plus sign as a space", () => {
    // decodeURIComponent is the right decoder here: it leaves "+" alone, unlike
    // decodeURIComponent applied to a query-string value.
    expect(toSafeFilename("a+b")).toBe("a+b");
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("throttleValue", () => {
  const WAIT = 40;

  test("runs the first call immediately", () => {
    const calls: number[] = [];
    const throttled = throttleValue((value) => calls.push(value), WAIT);

    throttled(0.1);

    expect(calls).toEqual([0.1]);
  });

  test("collapses a burst into one trailing call with the latest argument", async () => {
    const calls: number[] = [];
    const throttled = throttleValue((value) => calls.push(value), WAIT);

    throttled(0.1);
    throttled(0.2);
    throttled(0.3);

    expect(calls).toEqual([0.1]);

    await sleep(WAIT * 3);

    expect(calls).toEqual([0.1, 0.3]);
  });

  test("allows a new call once the window has passed", async () => {
    const calls: number[] = [];
    const throttled = throttleValue((value) => calls.push(value), WAIT);

    throttled(0.1);
    await sleep(WAIT * 3);
    throttled(0.9);

    expect(calls).toEqual([0.1, 0.9]);
  });

  test("keeps throttled functions independent of each other", async () => {
    const videos: number[] = [];
    const audios: number[] = [];
    const setVideo = throttleValue((value) => videos.push(value), WAIT);
    const setAudio = throttleValue((value) => audios.push(value), WAIT);

    setVideo(0.1);
    setVideo(0.2);
    setAudio(0.5);
    setAudio(0.6);

    expect(videos).toEqual([0.1]);
    expect(audios).toEqual([0.5]);

    await sleep(WAIT * 3);

    expect(videos).toEqual([0.1, 0.2]);
    expect(audios).toEqual([0.5, 0.6]);
  });
});
