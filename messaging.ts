import { defineExtensionMessaging } from "@webext-core/messaging";

import type { AudioRepresentation, VideoRepresentation } from "./src/types";

interface ProtocolMap {
  popupToBG_download(tabId: TabId): void;
  BGToContent_download(): void;
  contentToBg_OpenDownloadPage(downloadData: DownloadData): void;
  immediateDownload(url: string): void;
  BGToDownloadPage(downloadData: DownloadData): void;
}

export type DownloadData = {
  audio: AudioRepresentation;
  video: VideoRepresentation;
  baseUrl: string;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

export type TabId = number & { __brand: "TabId" };
