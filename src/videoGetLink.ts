export type VideoGetLinkParams = {
  videoId: string;
  resolution: string;
  ts: number;
  hash2: string;
};

type VideoGetLinkPayload = {
  result?: {
    status?: string;
    resp?: unknown;
  };
  error?: {
    code?: number;
    message?: string;
  };
};

export async function getVideoResourceUrl(
  pageUrl: string,
  { videoId, resolution, ts, hash2 }: VideoGetLinkParams,
): Promise<string> {
  const response = await fetch(pageUrl, {
    method: "POST",
    body: JSON.stringify({
      id: 3,
      jsonrpc: "2.0",
      method: "videoGetLink",
      params: [videoId, resolution, ts, hash2, {}],
    }),
  });

  if (!response.ok) {
    throw new Error(`CDA API responded with HTTP ${response.status}`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error("CDA API responded with a body that is not JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("CDA API responded with an unexpected payload");
  }

  const payload = parsed as VideoGetLinkPayload;

  if (payload.error) {
    const reason = payload.error.message || `code ${payload.error.code ?? "unknown"}`;
    throw new Error(`CDA API rejected the request: ${reason}`);
  }

  const resourceUrl = payload.result?.resp;

  if (typeof resourceUrl !== "string" || resourceUrl.length === 0) {
    const status = payload.result?.status;

    throw new Error(
      `CDA returned no link ${status ? `(${status})` : ""}. The video may be premium, blocked in your region, or no longer available.`,
    );
  }

  return resourceUrl;
}
