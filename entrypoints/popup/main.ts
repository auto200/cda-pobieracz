import { browser } from "wxt/browser";

import { onMessage, sendMessage } from "@/messaging";
import { getCdaVideoId } from "@/src/utils";

const requestId = crypto.randomUUID();

const button = document.querySelector<HTMLButtonElement>("#downloadButton");
const status = document.querySelector<HTMLParagraphElement>("#status");

if (!button || !status) {
  throw new Error("popup elements missing");
}

const setStatus = (message: string, disabled: boolean) => {
  status.hidden = false;
  status.textContent = message;
  button.disabled = disabled;
};

// The button stays disabled until the active tab turns out to hold a video, so the popup never
// offers to download from a page that has no content script to talk to.
const allowDownload = async () => {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  // `tab.url` is only filled in for tabs the extension may read, which is every cda.pl tab.
  // Everywhere else it stays undefined, which is exactly the case to report.
  const isVideoPage = tab?.url !== undefined && getCdaVideoId(tab.url) !== undefined;

  if (!isVideoPage) {
    setStatus("Otwórz stronę z filmem na cda.pl, aby móc go pobrać.", true);
    return;
  }

  button.disabled = false;
};

try {
  await allowDownload();
} catch (cause) {
  setStatus(cause instanceof Error ? cause.message : String(cause), true);
}

onMessage("BGToPopup_downloadResult", ({ data: result }) => {
  console.log(result);
  if (result.requestId !== requestId) {
    return;
  }

  switch (result.status) {
    case "started": {
      setStatus("Pobieranie...", true);
      break;
    }
    case "error": {
      setStatus(result.message, false);
      break;
    }
    case "success": {
      window.close();
      break;
    }
  }
});

button.addEventListener("click", async () => {
  try {
    await sendMessage("popupToBG_download", requestId);
  } catch (cause) {
    setStatus(cause instanceof Error ? cause.message : String(cause), false);
  }
});
