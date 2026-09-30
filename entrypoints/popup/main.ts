import { onMessage, sendMessage } from "@/messaging";

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

onMessage("BGToPopup_downloadResult", ({ data: result }) => {
  console.log(result);
  if (result.requestId !== requestId) {
    return;
  }

  switch (result.status) {
    case "started": {
      break;
    }
    case "error": {
      setStatus(result.message, false);
      break;
    }
    case "success": {
      window.close();
    }
  }
});

button.addEventListener("click", async () => {
  setStatus("Pobieranie...", true);

  try {
    await sendMessage("popupToBG_download", requestId);
  } catch (cause) {
    setStatus(cause instanceof Error ? cause.message : String(cause), false);
  }
});
