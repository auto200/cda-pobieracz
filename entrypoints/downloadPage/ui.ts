import { throttleValue } from "@/src/utils";

const PROGRESS_THROTTLE_MS = 60;

const videoProgress = document.querySelector<HTMLProgressElement>("#video-progress")!;
const audioProgress = document.querySelector<HTMLProgressElement>("#audio-progress")!;
const renderProgress = document.querySelector<HTMLProgressElement>("#render-progress")!;

const videoProgressValue = document.querySelector("#video-progress-value")!;
const audioProgressValue = document.querySelector("#audio-progress-value")!;
const renderProgressValue = document.querySelector("#render-progress-value")!;

const logs = document.querySelector<HTMLTextAreaElement>("#logs")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#downloadButton")!;

// Each bar gets its own throttled setter: audio and video download concurrently, so a
// shared throttle would let one stream's updates suppress the other's.
const renderBar = (bar: HTMLProgressElement, label: Element): ((ratio: number) => void) =>
  throttleValue((ratio) => {
    const value = ratio * 100;
    bar.value = value;
    label.textContent = `${Math.round(value)}%`;
  }, PROGRESS_THROTTLE_MS);

export const setVideoProgress = renderBar(videoProgress, videoProgressValue);
export const setAudioProgress = renderBar(audioProgress, audioProgressValue);
export const setRenderProgress = renderBar(renderProgress, renderProgressValue);

export function log(message: string) {
  logs.value += `${message}\n`;
  logs.scrollTop = logs.scrollHeight;
}

export function showDownloadButton(onclick: () => void) {
  downloadButton.onclick = onclick;
  downloadButton.style.opacity = "1";
  downloadButton.disabled = false;
}
