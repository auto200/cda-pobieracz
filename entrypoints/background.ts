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
      sendMessage("BGToDownloadPage_startDownload", { requestId, downloadData });
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

  onMessage("immediateDownload", ({ data: { url, filename } }) => {
    browser.downloads.download({
      url,
      filename,
      saveAs: true,
    });
  });

  onMessage("popupToBG_download", ({ data: tabId }) => {
    sendMessage("BGToContent_download", undefined, {
      tabId,
    });
  });
});
