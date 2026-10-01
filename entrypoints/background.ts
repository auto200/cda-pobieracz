import { browser } from "wxt/browser";

import { onMessage, sendMessage } from "@/messaging";

export default defineBackground(() => {
  onMessage("contentToBg_OpenDownloadPage", async ({ data: downloadData }) => {
    const requestId = crypto.randomUUID();

    const unsubscribe = onMessage("downloadPageToBG_ready", ({ data: readyRequestId }) => {
      if (readyRequestId !== requestId) {
        return;
      }

      unsubscribe();
      clearTimeout(timerId);
      sendMessage("BGToDownloadPage_startDownload", { requestId, downloadData }).catch(console.log);
    });

    const timerId = setTimeout(() => {
      unsubscribe();
      console.error("download page never declared readiness");
    }, 5000);

    await browser.tabs.create({
      active: true,
      url: browser.runtime.getURL(`/downloadPage.html?requestId=${requestId}`),
    });
  });

  onMessage("immediateDownload", async ({ data: { url, filename } }) => {
    await browser.downloads.download({
      url,
      filename,
      saveAs: true,
    });
  });

  onMessage("popupToBG_download", async ({ data: requestId }) => {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!tab?.id) {
      return;
    }
    sendMessage("BGToContent_download", requestId, { tabId: tab.id }).catch(console.log);
  });

  onMessage("contentToBg_downloadStatus", ({ data: result }) => {
    // The popup is only alive while it waits for a result, so a closed popup
    // simply has nowhere to show the message.
    sendMessage("BGToPopup_downloadResult", result).catch((cause: unknown) => {
      if (import.meta.env.DEV) {
        console.log("no popup was listening for the result", cause);
      }
    });
  });
});
