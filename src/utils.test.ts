import { describe, expect, test } from "bun:test";

import type { AudioRepresentation, VideoRepresentation } from "./types";
import { getBestAudio, getBestResolution, getBestVideo, throttleValue } from "./utils";

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
