// oxlint-disable typescript/no-non-null-assertion
import { throttleValue } from "@/src/utils";

const PROGRESS_THROTTLE_MS = 60;

const videoProgress = document.querySelector<HTMLProgressElement>("#video-progress")!;
const audioProgress = document.querySelector<HTMLProgressElement>("#audio-progress")!;
const renderProgress = document.querySelector<HTMLProgressElement>("#render-progress")!;

const videoProgressValue = document.querySelector("#video-progress-value")!;
const audioProgressValue = document.querySelector("#audio-progress-value")!;
const renderProgressValue = document.querySelector("#render-progress-value")!;
const etaValue = document.querySelector("#eta")!;
const downloadSpeedValue = document.querySelector("#downloadSpeed")!;

const logs = document.querySelector<HTMLTextAreaElement>("#logs")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#downloadButton")!;
const filename = document.querySelector<HTMLSpanElement>("#filename")!;

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

let downloadCompleted = false;
export const setETAStats = throttleValue(
  (eta: number, speed: number) => {
    if (downloadCompleted) return;
    etaValue.textContent = formatEta(eta);
    downloadSpeedValue.textContent = ` | ↓ ${formatBytesPerSecond(speed)}`;
  },
  1000,
  // we stagger the first call so we have more time to gather accurate data
  { staggerFirst: true },
);

export const hideETAStats = () => {
  downloadCompleted = true;
  etaValue.textContent = "";
  downloadSpeedValue.textContent = "";
  return;
};

const formatBytesPerSecond = (bytesPerSecond: number) => {
  if (bytesPerSecond <= 0) {
    return "0.0 MB/s";
  }

  const megabytesPerSecond = bytesPerSecond / 1024 ** 3;
  return `${megabytesPerSecond.toFixed(2)} MB/s`;
};

const formatEta = (milliseconds: number | null) => {
  if (milliseconds === null || milliseconds < 0 || !Number.isFinite(milliseconds)) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export function log(message: string) {
  logs.value += `${message}\n`;
  logs.scrollTop = logs.scrollHeight;
}

export function setFilename(value: string) {
  filename.textContent = value;
  filename.hidden = false;
}

export function activateDownloadButton(onclick: () => void) {
  downloadButton.onclick = onclick;
  downloadButton.style.opacity = "1";
  downloadButton.disabled = false;
}
