export type MediaRepresentation = AudioRepresentation | VideoRepresentation;

export type AudioRepresentation = {
  type: "audio";
  bandwidth: number;
  baseURL: string;
  codecs: string | null;
  mimeType: string | null;
};

export type VideoRepresentation = {
  type: "video";
  bandwidth: number;
  baseURL: string;
  codecs: string | null;
  height: number;
  mimeType: string | null;
  width: number;
};
