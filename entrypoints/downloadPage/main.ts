import { FFmpeg } from "@ffmpeg/ffmpeg";
import { browser } from "wxt/browser";

import { onMessage, sendMessage } from "@/messaging";
import { downloadToMemory } from "@/src/utils";

import {
  log,
  setAudioProgress,
  setRenderProgress,
  setVideoProgress,
  showDownloadButton,
} from "./ui";

const requestId = new URL(location.href).searchParams.get("requestId");

const downloadToFfmpeg = async (
  ffmpeg: FFmpeg,
  name: string,
  url: string,
  onProgress: (ratio: number) => void,
) => {
  const startTime = Date.now();

  try {
    const file = await downloadToMemory(url, onProgress);

    await ffmpeg.writeFile(`${name}.mp4`, file);
  } catch (cause) {
    throw new Error(
      `${name} download failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }

  log(`${name} pobrano w: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
};

onMessage("BGToDownloadPage_startDownload", async ({ data: request }) => {
  if (request.requestId !== requestId) {
    return;
  }

  const { downloadData } = request;
  console.log(downloadData);
  const ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => {
    log(message);
  });

  ffmpeg.on("progress", ({ progress }) => {
    setRenderProgress(progress);
  });

  await ffmpeg.load({
    coreURL: browser.runtime.getURL("/ffmpeg-core.js"),
    wasmURL: browser.runtime.getURL("/ffmpeg-core.wasm"),
  });
  log("ffmpeg loaded");

  const downloads = await Promise.allSettled([
    downloadToFfmpeg(
      ffmpeg,
      "video",
      `${downloadData.baseUrl}/${downloadData.video.baseURL}`,
      setVideoProgress,
    ),
    downloadToFfmpeg(
      ffmpeg,
      "audio",
      `${downloadData.baseUrl}/${downloadData.audio.baseURL}`,
      setAudioProgress,
    ),
  ]);

  const failures = downloads.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      log(failure instanceof Error ? failure.message : String(failure));
    }

    ffmpeg.terminate();
    return;
  }

  const renderStartTime = Date.now();
  await ffmpeg.exec([
    "-i",
    "video.mp4",
    "-i",
    "audio.mp4",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "output.mp4",
  ]);

  log(`wyrenderowano w: ${((Date.now() - renderStartTime) / 1000).toFixed(2)}s`);

  void ffmpeg.deleteFile("audio.mp4");
  void ffmpeg.deleteFile("video.mp4");
  const data = await ffmpeg.readFile("output.mp4");
  void ffmpeg.deleteFile("output.mp4");
  ffmpeg.terminate();

  if (typeof data === "string") {
    log("ffmpeg returned text data instead of binary");
    return;
  }

  // readFile returns a Uint8Array transferred from the ffmpeg worker, so it is backed by a
  // plain ArrayBuffer rather than a SharedArrayBuffer. Blob's type cannot express that.
  const url = URL.createObjectURL(
    new Blob([data as Uint8Array<ArrayBuffer>], { type: "video/mp4" }),
  );

  const download = async () => {
    await browser.downloads.download({
      url,
      filename: downloadData.filename,
      saveAs: true,
    });
  };

  showDownloadButton(download);
  await download();
});

if (requestId) {
  await sendMessage("downloadPageToBG_ready", requestId);
} else {
  log("error: request id missing");
}
