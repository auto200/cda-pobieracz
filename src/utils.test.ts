import { expect, test } from "bun:test";

import { getBestResolution } from "./utils";

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
