import { browser } from "wxt/browser";

import { onMessage, sendMessage } from "@/messaging";

export default defineBackground(() => {
  onMessage("contentToBg_OpenDownloadPage", async ({ data: downloadData }) => {
    const tab = await browser.tabs.create({
      active: true,
      url: browser.runtime.getURL("/downloadPage.html"),
    });

    if (!tab.id) {
      return;
    }
    await new Promise((res) => {
      setTimeout(res, 100);
    });

    sendMessage("BGToDownloadPage", downloadData);
  });

  onMessage("immediateDownload", ({ data: url }) => {
    browser.downloads.download({
      url,
      filename: "video.mp4",
      saveAs: true,
    });
  });

  onMessage("popupToBG_download", ({ data: tabId }) => {
    sendMessage("BGToContent_download", undefined, {
      tabId,
    });
  });
});
