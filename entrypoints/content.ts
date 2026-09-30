import { onMessage, sendMessage } from "@/messaging";
import { parseRepresentations } from "@/src/manifest";
import { getBestResolution, getHighestBandwidth } from "@/src/utils";

export default defineContentScript({
  matches: ["*://*.cda.pl/*"],
  main() {
    if (import.meta.env.DEV) {
      setInterval(() => {
        document.querySelector(".fc-consent-root")?.remove();
        document.querySelector(".fc-message-root")?.remove();
        document.body.style.overflow = "auto";
      }, 200);
    }

    onMessage("BGToContent_download", async () => {
      const videoId = location.href.match(/\/video\/([^/]+)/)?.[1];

      if (!videoId) {
        console.log("videoid not found");
        return;
      }

      const mediaplayerElement = document.querySelector(`#mediaplayer${videoId}`);
      if (!mediaplayerElement) {
        console.log("mediaplayer element not found");
        return;
      }

      const rawMediaData = mediaplayerElement.getAttribute("player_data");

      if (!rawMediaData) {
        console.log("mediaplayer element did not contain player data");
        return;
      }

      const mediaData = JSON.parse(rawMediaData) as MediaData;
      console.log(mediaData);
      const bestResolution = getBestResolution(mediaData.video.qualities);
      const res = (await (
        await fetch(window.location.href, {
          method: "POST",
          body: JSON.stringify({
            id: 3,
            jsonrpc: "2.0",
            method: "videoGetLink",
            params: [videoId, bestResolution, mediaData.video.ts, mediaData.video.hash2, {}],
          }),
        })
      ).json()) as VideoGetLinkResponse;
      if (import.meta.env.DEV) {
        console.log(res);
      }

      const resourceUrl = res.result.resp;
      if (resourceUrl.endsWith(".mp4")) {
        sendMessage("immediateDownload", { url: resourceUrl, filename: "video.mp4" });
        return;
      }

      const resourcesBaseUrl = resourceUrl.split("/").slice(0, -1).join("/");

      const xmlManifestString = await (await fetch(resourceUrl)).text();

      const representations = parseRepresentations(xmlManifestString);
      const audioRepresentations = representations.filter((r) => r.type === "audio");
      const videoRepresentations = representations.filter((r) => r.type === "video");

      const bestVideo = getHighestBandwidth(videoRepresentations);
      const bestAudio = getHighestBandwidth(audioRepresentations);

      if (bestVideo && bestAudio) {
        sendMessage("contentToBg_OpenDownloadPage", {
          video: bestVideo,
          audio: bestAudio,
          baseUrl: resourcesBaseUrl,
          filename: "video.mp4",
        });
        return;
      }

      const singleStream = bestVideo ?? bestAudio;
      if (singleStream) {
        sendMessage("immediateDownload", {
          url: `${resourcesBaseUrl}/${singleStream.baseURL}`,
          filename: bestVideo ? "video.mp4" : "audio.mp4",
        });
        return;
      }

      console.log("no audio or video representations found");
    });
  },
});

type VideoGetLinkResponse = {
  result: {
    status: string;
    resp: string;
  };
  id: string;
  jsonrpc: string;
};

type MediaData = {
  id: string;
  ads: {
    schedule: Array<{
      enabled: boolean;
      counter: boolean;
      skip: boolean;
      click: boolean;
      key: string;
      key2: string;
      tag: string;
      tagAdblock?: string;
      repeat: number;
      time: number;
      type: string;
      displayAs: string;
      safe: boolean;
    }>;
  };
  video: {
    id: string;
    file: string;
    file_cast: string;
    cast_available: boolean;
    manifest: string;
    manifest_cast: string;
    manifest_drm_proxy: any;
    manifest_drm_header: any;
    manifest_drm_pr_proxy: any;
    manifest_drm_pr_header: any;
    manifest_apple: string;
    manifest_drm_apple_certificate: any;
    manifest_drm_apple_license: any;
    manifest_audio_stereo_bitrate: number;
    manifest_forced_audio_hd: boolean;
    manifest_auto_quality: boolean;
    duration: string;
    durationFull: string;
    poster: string;
    type: string;
    video_promoted: boolean;
    width: number;
    height: number;
    content_rating: number;
    parental_guide: any;
    sponsored_label: boolean;
    quality: string;
    qualities: Record<string, string>;
    quality_change_in_player: boolean;
    ts: number;
    hash: string;
    hash2: string;
    premium_categories: string;
    title: string;
    thumb: string;
    partner_id: string;
  };
  nextVideo: {
    id: string;
    title: string;
    thumb: string;
    user: string;
    quality: any;
    link: string;
  };
  autoplay: boolean;
  seekTo: number;
  premium: boolean;
  api: {
    client: string;
    client2: string;
    ts: string;
    key: string;
    method: string;
  };
  user: {
    role: string;
    id: number;
    uid: string;
    gender: string;
    video_history: boolean;
    device_id: string;
    ip: string;
  };
  plista: boolean;
  adOnPauseEnabled: boolean;
  adOnPauseElement: string;
};
export type ManifestJson = {
  MPD: {
    xmlns: string;
    "xmlns:xsi": string;
    "xsi:schemaLocation": string;
    profiles: string;
    minBufferTime: string;
    type: string;
    mediaPresentationDuration: string;
    children: Array<{
      Period: {
        id: string;
        children: Array<{
          AdaptationSet: {
            id: string;
            contentType: string;
            width?: string;
            height?: string;
            frameRate?: string;
            subsegmentAlignment: string;
            par?: string;
            children: Array<{
              Representation?: {
                id: string;
                bandwidth: string;
                codecs: string;
                mimeType: string;
                audioSamplingRate?: string;
                children: Array<{
                  AudioChannelConfiguration?: {
                    schemeIdUri: string;
                    value: string;
                  };
                  BaseURL?: {
                    content: string;
                  };
                  SegmentBase?: {
                    indexRange: string;
                    timescale: string;
                    children: Array<{
                      Initialization: {
                        range: string;
                      };
                    }>;
                  };
                }>;
                sar?: string;
                width?: string;
                height?: string;
              };
              SupplementalProperty?: {
                schemeIdUri: string;
                value: string;
              };
            }>;
            maxWidth?: string;
            maxHeight?: string;
            subsegmentStartsWithSAP?: string;
          };
        }>;
      };
    }>;
  };
};
