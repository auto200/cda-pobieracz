import { defineExtensionMessaging } from "@webext-core/messaging";

import type { AudioRepresentation, VideoRepresentation } from "./src/types";

interface ProtocolMap {
  popupToBG_download(tabId: TabId): void;
  BGToContent_download(): void;
  contentToBg_OpenDownloadPage(downloadData: DownloadData): void;
  immediateDownload(download: ImmediateDownload): void;
  downloadPageToBG_ready(requestId: string): void;
  BGToDownloadPage_startDownload(request: DownloadRequest): void;
}

export type ImmediateDownload = {
  url: string;
  filename: string;
};

export type DownloadData = {
  audio: AudioRepresentation;
  video: VideoRepresentation;
  baseUrl: string;
  filename: string;
};

export type DownloadRequest = {
  requestId: string;
  downloadData: DownloadData;
};

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

export type TabId = number & { __brand: "TabId" };
