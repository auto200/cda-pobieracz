import { defineExtensionMessaging } from "@webext-core/messaging";

import type { AudioRepresentation, VideoRepresentation } from "./src/types";

type ProtocolMap = {
  popupToBG_download(requestId: string): void;
  BGToContent_download(requestId: string): void;
  contentToBg_OpenDownloadPage(downloadData: DownloadData): void;
  contentToBg_downloadStatus(result: DownloadStatus): void;
  BGToPopup_downloadResult(result: DownloadStatus): void;
  immediateDownload(download: ImmediateDownload): void;
  downloadPageToBG_ready(requestId: string): void;
  BGToDownloadPage_startDownload(request: DownloadRequest): void;
};

export type DownloadStatus = (
  | { status: "started" }
  | { status: "error"; message: string }
  | { status: "success" }
) & { requestId: string };

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
