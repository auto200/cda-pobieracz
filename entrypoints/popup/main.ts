import { sendMessage, type TabId } from "@/messaging";

const button = document.querySelector("#downloadButton");
if (!button) {
  throw new Error("download button missing");
}

button.addEventListener("click", async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (!tab?.id) {
    return;
  }

  sendMessage("popupToBG_download", tab.id as TabId);
});
