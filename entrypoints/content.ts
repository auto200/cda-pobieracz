// oxlint-disable typescript/no-explicit-any
import { onMessage, sendMessage, type DownloadStatus } from "@/messaging";
import { parseRepresentations } from "@/src/manifest";
import { getBestAudio, getBestResolution, getBestVideo } from "@/src/utils";
import { getVideoResourceUrl } from "@/src/videoGetLink";

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

    onMessage("BGToContent_download", async ({ data: requestId }) => {
      const report = (result: DownloadStatus) => {
        // Never let a failed report mask the error it was meant to describe.
        return sendMessage("contentToBg_downloadStatus", result).catch((cause: unknown) => {
          console.error("could not deliver the download result", cause);
        });
      };

      try {
        await report({ status: "started", requestId });
        const { videoId, mediaData, resolution } = getMediaData();

        const resourceUrl = await getVideoResourceUrl(location.href, {
          videoId,
          resolution,
          ts: mediaData.video.ts,
          hash2: mediaData.video.hash2,
        });

        await report({ status: "success", requestId });
        await startDownload(resourceUrl);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        console.log("error:", message);
        await report({
          status: "error",
          message,
          requestId,
        });
      }
    });

    const getMediaData = () => {
      const videoId = location.href.match(/\/video\/([^/]+)/)?.[1];

      if (!videoId) {
        throw new Error("could not find a video id in the page address");
      }

      const mediaplayerElement = document.querySelector(`#mediaplayer${videoId}`);
      if (!mediaplayerElement) {
        throw new Error("could not find the video player on the page");
      }

      const rawMediaData = mediaplayerElement.getAttribute("player_data");

      if (!rawMediaData) {
        throw new Error("the video player did not contain any player data");
      }

      const mediaData = JSON.parse(rawMediaData) as MediaData;
      const resolution = getBestResolution(mediaData.video.qualities);

      if (resolution === undefined) {
        throw new Error("the player data did not list any usable quality");
      }

      return { videoId, mediaData, resolution };
    };

    const startDownload = async (resourceUrl: string) => {
      if (resourceUrl.endsWith(".mp4")) {
        await sendMessage("immediateDownload", { url: resourceUrl, filename: "video.mp4" });
        return;
      }

      const resourcesBaseUrl = resourceUrl.split("/").slice(0, -1).join("/");
      const manifestResponse = await fetch(resourceUrl);

      if (!manifestResponse.ok) {
        throw new Error(`manifest request failed with HTTP ${manifestResponse.status}`);
      }

      const representations = parseRepresentations(await manifestResponse.text());
      const audioRepresentations = representations.filter((r) => r.type === "audio");
      const videoRepresentations = representations.filter((r) => r.type === "video");

      const bestVideo = getBestVideo(videoRepresentations);
      const bestAudio = getBestAudio(audioRepresentations);

      if (bestVideo && bestAudio) {
        await sendMessage("contentToBg_OpenDownloadPage", {
          video: bestVideo,
          audio: bestAudio,
          baseUrl: resourcesBaseUrl,
          filename: "video.mp4",
        });
        return;
      }

      const singleStream = bestVideo ?? bestAudio;
      if (singleStream) {
        await sendMessage("immediateDownload", {
          url: `${resourcesBaseUrl}/${singleStream.baseURL}`,
          filename: bestVideo ? "video.mp4" : "audio.mp4",
        });
        return;
      }

      throw new Error("the manifest contained no audio or video representations");
    };
  },
});

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
