const videoProgress = document.querySelector<HTMLProgressElement>("#video-progress")!;
const audioProgress = document.querySelector<HTMLProgressElement>("#audio-progress")!;
const renderProgress = document.querySelector<HTMLProgressElement>("#render-progress")!;

const videoProgressValue = document.querySelector("#video-progress-value")!;
const audioProgressValue = document.querySelector("#audio-progress-value")!;
const renderProgressValue = document.querySelector("#render-progress-value")!;

const logs = document.querySelector<HTMLTextAreaElement>("#logs")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#downloadButton")!;

export function setVideoProgress(value: number) {
  value = value * 100;
  videoProgress.value = value;
  videoProgressValue.textContent = `${Math.round(value)}%`;
}

export function setAudioProgress(value: number) {
  value = value * 100;

  audioProgress.value = value;
  audioProgressValue.textContent = `${Math.round(value)}%`;
}

export function setRenderProgress(value: number) {
  value = value * 100;

  renderProgress.value = value;
  renderProgressValue.textContent = `${Math.round(value)}%`;
}

export function log(message: string) {
  logs.value += `${message}\n`;
  logs.scrollTop = logs.scrollHeight;
}

export function showDownloadButton(onclick: () => void) {
  downloadButton.onclick = onclick;
  downloadButton.style.opacity = "1";
  downloadButton.disabled = false;
}
