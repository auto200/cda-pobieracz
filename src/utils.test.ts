import { describe, expect, test } from "bun:test";

import type { AudioRepresentation, VideoRepresentation } from "./types";
import { getBestResolution, getHighestBandwidth, throttleValue } from "./utils";

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
  ])("returns correct quality", (qs, expected) => {
    expect(getBestResolution(qs)).toBe(expected);
  });
});

const audio = (bandwidth: number, baseURL: string): AudioRepresentation => ({
  type: "audio",
  bandwidth,
  baseURL,
  codecs: null,
  mimeType: null,
});

const video = (bandwidth: number, baseURL: string): VideoRepresentation => ({
  type: "video",
  bandwidth,
  baseURL,
  codecs: null,
  mimeType: null,
  width: 1920,
  height: 1080,
});

describe("getHighestBandwidth", () => {
  const audioLow = audio(128_000, "audio-low.mp4");
  const audioHigh = audio(256_000, "audio-high.mp4");
  const videoLow = video(800_000, "video-low.mp4");
  const videoHigh = video(2_400_000, "video-high.mp4");

  test.each([
    [[audioLow, audioHigh], audioHigh],
    [[audioHigh, audioLow], audioHigh],
    [[videoLow, videoHigh], videoHigh],
    [[videoHigh, videoLow], videoHigh],
    [[audioLow], audioLow],
    [[videoHigh, audioHigh, videoLow], videoHigh],
  ])("returns the representation with the highest bandwidth", (representations, expected) => {
    expect(getHighestBandwidth(representations)).toBe(expected);
  });

  test("returns undefined for an empty list", () => {
    expect(getHighestBandwidth<AudioRepresentation>([])).toBeUndefined();
  });

  test("keeps the first representation when bandwidths are equal", () => {
    const first = video(1_000_000, "first.mp4");
    const second = video(1_000_000, "second.mp4");

    expect(getHighestBandwidth([first, second])).toBe(first);
  });

  test("returns a representation with zero bandwidth", () => {
    const zero = audio(0, "zero.mp4");

    expect(getHighestBandwidth([zero])).toBe(zero);
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
    const video: number[] = [];
    const audio: number[] = [];
    const setVideo = throttleValue((value) => video.push(value), WAIT);
    const setAudio = throttleValue((value) => audio.push(value), WAIT);

    setVideo(0.1);
    setVideo(0.2);
    setAudio(0.5);
    setAudio(0.6);

    expect(video).toEqual([0.1]);
    expect(audio).toEqual([0.5]);

    await sleep(WAIT * 3);

    expect(video).toEqual([0.1, 0.2]);
    expect(audio).toEqual([0.5, 0.6]);
  });
});
