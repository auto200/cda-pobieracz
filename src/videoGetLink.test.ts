import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { getVideoResourceUrl, type VideoGetLinkParams } from "./videoGetLink";

const PARAMS: VideoGetLinkParams = {
  videoId: "abcdef123",
  resolution: "1080",
  ts: 1700000000,
  hash2: "deadbeef",
};

const MANIFEST_URL = "https://vod.cda.pl/abc/1080/manifest.mpd";

type Captured = { method: string; body: string };

let server: ReturnType<typeof Bun.serve>;
let origin: string;
let captured: Captured;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      captured = {
        method: request.method,
        body: await request.text(),
      };

      switch (new URL(request.url).pathname) {
        case "/ok":
          return json({ jsonrpc: "2.0", id: 3, result: { status: "OK", resp: MANIFEST_URL } });
        case "/mp4":
          return json({
            jsonrpc: "2.0",
            id: 3,
            result: { status: "OK", resp: "https://vod.cda.pl/abc/video.mp4" },
          });
        case "/http-error":
          return json({}, 500);
        case "/not-json":
          return new Response("<html>error</html>", { status: 200 });
        case "/json-rpc-error":
          return json({ jsonrpc: "2.0", id: 3, error: { code: 403, message: "premium only" } });
        case "/error-without-message":
          return json({ jsonrpc: "2.0", id: 3, error: { code: -32000 } });
        case "/no-result":
          return json({ jsonrpc: "2.0", id: 3 });
        case "/empty-resp":
          return json({ jsonrpc: "2.0", id: 3, result: { status: "ERROR", resp: "" } });
        case "/numeric-resp":
          return json({ jsonrpc: "2.0", id: 3, result: { status: "OK", resp: 42 } });
        case "/null-payload":
          return new Response("null", { status: 200 });
        default:
          return json({ error: "unknown" }, 404);
      }
    },
  });

  origin = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

describe("getVideoResourceUrl", () => {
  test("returns the link on success", async () => {
    expect(await getVideoResourceUrl(`${origin}/ok`, PARAMS)).toBe(MANIFEST_URL);
  });

  test("posts the json-rpc request the API expects", async () => {
    await getVideoResourceUrl(`${origin}/ok`, PARAMS);

    expect(captured.method).toBe("POST");
    expect(JSON.parse(captured.body)).toEqual({
      id: 3,
      jsonrpc: "2.0",
      method: "videoGetLink",
      params: [PARAMS.videoId, PARAMS.resolution, PARAMS.ts, PARAMS.hash2, {}],
    });
  });

  test("rejects on a non-2xx response", async () => {
    expect(getVideoResourceUrl(`${origin}/http-error`, PARAMS)).rejects.toThrow(
      "CDA API responded with HTTP 500",
    );
  });

  test("rejects on a body that is not JSON", async () => {
    expect(getVideoResourceUrl(`${origin}/not-json`, PARAMS)).rejects.toThrow(
      "CDA API responded with a body that is not JSON",
    );
  });

  test("rejects on a null payload", async () => {
    expect(getVideoResourceUrl(`${origin}/null-payload`, PARAMS)).rejects.toThrow(
      "CDA API responded with an unexpected payload",
    );
  });

  test("surfaces the message of a json-rpc error", async () => {
    expect(getVideoResourceUrl(`${origin}/json-rpc-error`, PARAMS)).rejects.toThrow(
      "CDA API rejected the request: premium only",
    );
  });

  test("falls back to the error code when there is no message", async () => {
    expect(getVideoResourceUrl(`${origin}/error-without-message`, PARAMS)).rejects.toThrow(
      "CDA API rejected the request: code -32000",
    );
  });

  test("rejects when there is no result at all", async () => {
    expect(getVideoResourceUrl(`${origin}/no-result`, PARAMS)).rejects.toThrow(
      "CDA returned no link. The video may be premium, blocked in your region, or no longer available.",
    );
  });

  test("rejects on an empty link and reports the status", async () => {
    expect(getVideoResourceUrl(`${origin}/empty-resp`, PARAMS)).rejects.toThrow(
      "CDA returned no link (ERROR). The video may be premium, blocked in your region, or no longer available.",
    );
  });

  test("rejects when the link is not a string", async () => {
    expect(getVideoResourceUrl(`${origin}/numeric-resp`, PARAMS)).rejects.toThrow(
      "CDA returned no link (OK). The video may be premium, blocked in your region, or no longer available.",
    );
  });

  test("still resolves a direct mp4 link", async () => {
    expect(await getVideoResourceUrl(`${origin}/mp4`, PARAMS)).toBe(
      "https://vod.cda.pl/abc/video.mp4",
    );
  });
});
