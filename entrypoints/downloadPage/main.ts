import { FFmpeg } from "@ffmpeg/ffmpeg";
import { downloadWithProgress } from "@ffmpeg/util";
import { browser } from "wxt/browser";

import { onMessage, sendMessage } from "@/messaging";

import {
  log,
  setAudioProgress,
  setRenderProgress,
  setVideoProgress,
  showDownloadButton,
} from "./ui";

const requestId = new URL(location.href).searchParams.get("requestId");

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

  const response = await Promise.allSettled([
    (async () => {
      const videoStartTime = Date.now();
      const videoFile = new Uint8Array(
        await downloadWithProgress(
          `${downloadData.baseUrl}/${downloadData.video.baseURL}`,
          ({ received, total }) => {
            setVideoProgress(received / total);
          },
        ),
      );
      log(`video pobrano w: ${((Date.now() - videoStartTime) / 1000).toFixed(2)}s`);

      await ffmpeg.writeFile("video.mp4", videoFile);
    })(),
    (async () => {
      const audioStartTime = Date.now();
      const audioFile = new Uint8Array(
        await downloadWithProgress(
          `${downloadData.baseUrl}/${downloadData.audio.baseURL}`,
          ({ received, total }) => {
            setAudioProgress(received / total);
          },
        ),
      );
      log(`audio pobrano w: ${((Date.now() - audioStartTime) / 1000).toFixed(2)}s`);

      await ffmpeg.writeFile("audio.mp4", audioFile);
    })(),
  ]);

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

  ffmpeg.deleteFile("audio.mp4");
  ffmpeg.deleteFile("video.mp4");
  const data = await ffmpeg.readFile("output.mp4");
  ffmpeg.deleteFile("output.mp4");

  // @ts-ignore
  const url = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));

  const download = () => {
    browser.downloads.download({
      url,
      filename: downloadData.filename,
      saveAs: true,
    });
  };

  showDownloadButton(download);
  download();
});

if (requestId) {
  sendMessage("downloadPageToBG_ready", requestId);
} else {
  log("error: request id missing");
}
