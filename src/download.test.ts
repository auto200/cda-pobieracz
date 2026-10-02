import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { downloadToMemory, type DownloadProgress } from "./utils";

const PAYLOAD = new Uint8Array(64 * 1024).map((_, index) => index % 251);

let server: ReturnType<typeof Bun.serve>;
let origin: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;

      switch (path) {
        case "/ok":
          return new Response(PAYLOAD, {
            headers: { "Content-Type": "video/mp4" },
          });
        case "/forbidden":
          return new Response("nope", { status: 403, statusText: "Forbidden" });
        case "/gone":
          return new Response("gone", { status: 410 });
        case "/no-content-length": {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(PAYLOAD.subarray(0, 1024));
              controller.enqueue(PAYLOAD.subarray(1024));
              controller.close();
            },
          });

          return new Response(stream, { headers: { "Content-Type": "video/mp4" } });
        }
        default:
          return new Response("not found", { status: 404 });
      }
    },
  });

  origin = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

describe("downloadToMemory", () => {
  test("returns the exact bytes served", async () => {
    const bytes = await downloadToMemory(`${origin}/ok`);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(PAYLOAD.byteLength);
    expect(bytes).toEqual(PAYLOAD);
  });

  test("reports progress up to 1", async () => {
    const progresses: DownloadProgress[] = [];

    await downloadToMemory(`${origin}/ok`, (progress) => progresses.push(progress));

    expect(progresses.length).toBeGreaterThan(1);
    expect(progresses.at(-1)).toEqual({
      received: 65536,
      total: 65536,
      ratio: 1,
    });
    expect(progresses.every((progress) => progress.ratio >= 0 && progress.ratio <= 1)).toBe(true);
    expect([...progresses].sort((a, b) => a.ratio - b.ratio)).toEqual(progresses);
  });

  test("rejects on 403 instead of returning the error body", () => {
    expect(downloadToMemory(`${origin}/forbidden`)).rejects.toThrow("HTTP 403 Forbidden");
  });

  test("rejects on 410", () => {
    expect(downloadToMemory(`${origin}/gone`)).rejects.toThrow("HTTP 410");
  });

  test("rejects on 404", () => {
    expect(downloadToMemory(`${origin}/missing`)).rejects.toThrow("HTTP 404");
  });

  test("handles a response without Content-Length", async () => {
    const progresses: DownloadProgress[] = [];

    const bytes = await downloadToMemory(`${origin}/no-content-length`, (progress) =>
      progresses.push(progress),
    );

    expect(bytes).toEqual(PAYLOAD);
    expect(progresses).toEqual([
      {
        ratio: 1,
        received: 65536,
        total: undefined,
      },
    ]);
  });

  test("works without a progress callback", async () => {
    expect(await downloadToMemory(`${origin}/ok`)).toEqual(PAYLOAD);
  });

  test("rejects when fewer bytes arrive than Content-Length promised", () => {
    const truncated = new Response(PAYLOAD.subarray(0, 100), {
      headers: { "Content-Length": String(PAYLOAD.byteLength) },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => truncated) as unknown as typeof fetch;

    try {
      expect(downloadToMemory("https://example.test/video.mp4")).rejects.toThrow(
        `incomplete download, received 100 of ${PAYLOAD.byteLength} bytes`,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
