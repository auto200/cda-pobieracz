import type { MediaRepresentation } from "./types";
import { isNotNullable } from "./utils";

const DASH_NS = "urn:mpeg:dash:schema:mpd:2011";

export function parseRepresentations(manifestXml: string): MediaRepresentation[] {
  const doc = new DOMParser().parseFromString(manifestXml, "application/xml");

  return [...doc.getElementsByTagNameNS(DASH_NS, "Representation")]
    .map(parseRepresentation)
    .filter(isNotNullable);
}

function parseRepresentation(rep: Element): MediaRepresentation | undefined {
  const baseURL = rep.getElementsByTagNameNS(DASH_NS, "BaseURL")[0]?.textContent.trim();
  if (!baseURL) {
    return undefined;
  }

  const adaptationSet = rep.parentElement;

  const width = toNumber(rep.getAttribute("width") ?? adaptationSet?.getAttribute("width"));
  const height = toNumber(rep.getAttribute("height") ?? adaptationSet?.getAttribute("height"));

  const contentType = adaptationSet?.getAttribute("contentType");
  const isVideo = contentType ? contentType === "video" : Boolean(width && height);

  const common = {
    bandwidth: toNumber(rep.getAttribute("bandwidth")),
    codecs: rep.getAttribute("codecs"),
    mimeType: rep.getAttribute("mimeType"),
    baseURL,
  };

  if (isVideo) {
    return { type: "video", ...common, width, height };
  }

  return { type: "audio", ...common };
}

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
