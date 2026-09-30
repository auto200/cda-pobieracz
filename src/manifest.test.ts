import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { parseRepresentations } from "./manifest";
import type { AudioRepresentation, VideoRepresentation } from "./types";
import { getHighestBandwidth } from "./utils";

// Registered per file rather than on import, because happy-dom replaces the global
// fetch with a strict browser
beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

/**
 * Two video AdaptationSets with a single Representation each, both 720p. The Representations carry
 * no width/height, so the parser has to inherit them from the AdaptationSet. 30fps, ~1:54.
 */
const dimensionsOnAdaptationSet = `<?xml version="1.0" encoding="UTF-8"?>
<!--Generated with https://github.com/shaka-project/shaka-packager version v3.4.2-c819dea-release-->
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT2S" type="static" mediaPresentationDuration="PT113.933334S">
  <Period id="0">
    <AdaptationSet id="0" contentType="video" width="1280" height="720" frameRate="15360/512" subsegmentAlignment="true" par="16:9">
      <Representation id="0" bandwidth="1293442" codecs="avc1.42c01e" mimeType="video/mp4" sar="1:1">
        <BaseURL>lqab3314c0f6da15f749a59a0808cccc39.mp4</BaseURL>
        <SegmentBase indexRange="833-1092" timescale="15360">
          <Initialization range="0-832"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet id="1" contentType="video" width="1280" height="720" frameRate="15360/512" subsegmentAlignment="true" par="16:9">
      <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:TransferCharacteristics" value="1"/>
      <Representation id="1" bandwidth="629889" codecs="avc1.64001f" mimeType="video/mp4" sar="1:1">
        <BaseURL>sdab3314c0f6da15f749a59a0808cccc39.mp4</BaseURL>
        <SegmentBase indexRange="874-1121" timescale="15360">
          <Initialization range="0-873"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet id="2" contentType="audio" subsegmentStartsWithSAP="1" subsegmentAlignment="true">
      <Representation id="2" bandwidth="129859" codecs="mp4a.40.2" mimeType="audio/mp4" audioSamplingRate="44100">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
        <BaseURL>a_sdab3314c0f6da15f749a59a0808cccc39.mp4</BaseURL>
        <SegmentBase indexRange="782-1053" timescale="44100">
          <Initialization range="0-781"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

/**
 * Two video AdaptationSets holding two Representations each, spanning 360p to 1080p. The
 * AdaptationSets only declare maxWidth/maxHeight, so each Representation carries its own
 * width/height. 50fps, ~21:40.
 */
const dimensionsOnRepresentation = `<?xml version="1.0" encoding="UTF-8"?>
<!--Generated with https://github.com/shaka-project/shaka-packager version v3.4.2-c819dea-release-->
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT2S" type="static" mediaPresentationDuration="PT1299.839966S">
  <Period id="0">
    <AdaptationSet id="0" contentType="video" maxWidth="1920" maxHeight="1080" frameRate="12800/256" par="16:9">
      <SupplementalProperty schemeIdUri="urn:mpeg:mpegB:cicp:TransferCharacteristics" value="1"/>
      <Representation id="0" bandwidth="2671508" codecs="avc1.640020" mimeType="video/mp4" sar="1:1" width="1280" height="720">
        <BaseURL>sd7aa24d3751a1a0448a25e63af3a30a1a.mp4</BaseURL>
        <SegmentBase indexRange="874-3497" timescale="12800">
          <Initialization range="0-873"/>
        </SegmentBase>
      </Representation>
      <Representation id="1" bandwidth="4119345" codecs="avc1.64002a" mimeType="video/mp4" sar="1:1" width="1920" height="1080">
        <BaseURL>hd7aa24d3751a1a0448a25e63af3a30a1a.mp4</BaseURL>
        <SegmentBase indexRange="876-3499" timescale="12800">
          <Initialization range="0-875"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet id="1" contentType="video" maxWidth="854" maxHeight="480" frameRate="12800/256" subsegmentAlignment="true" par="16:9">
      <Representation id="2" bandwidth="696766" codecs="avc1.42c015" mimeType="video/mp4" sar="1:1" width="640" height="360">
        <BaseURL>vl7aa24d3751a1a0448a25e63af3a30a1a.mp4</BaseURL>
        <SegmentBase indexRange="835-3470" timescale="12800">
          <Initialization range="0-834"/>
        </SegmentBase>
      </Representation>
      <Representation id="3" bandwidth="1398554" codecs="avc1.42c01e" mimeType="video/mp4" sar="1:1" width="854" height="480">
        <BaseURL>lq7aa24d3751a1a0448a25e63af3a30a1a.mp4</BaseURL>
        <SegmentBase indexRange="835-3470" timescale="12800">
          <Initialization range="0-834"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet id="2" contentType="audio" subsegmentStartsWithSAP="1" subsegmentAlignment="true">
      <Representation id="4" bandwidth="134322" codecs="mp4a.40.2" mimeType="audio/mp4" audioSamplingRate="44100">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
        <BaseURL>a_lq7aa24d3751a1a0448a25e63af3a30a1a.mp4</BaseURL>
        <SegmentBase indexRange="833-3468" timescale="44100">
          <Initialization range="0-832"/>
        </SegmentBase>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

const wrap = (adaptationSetAttrs: string, representationAttrs: string, baseURL?: string) => `
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet ${adaptationSetAttrs}>
      <Representation ${representationAttrs}>
        ${baseURL === undefined ? "" : `<BaseURL>${baseURL}</BaseURL>`}
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

const videoOnly = (representations: ReturnType<typeof parseRepresentations>) =>
  representations.filter((r): r is VideoRepresentation => r.type === "video");

const audioOnly = (representations: ReturnType<typeof parseRepresentations>) =>
  representations.filter((r): r is AudioRepresentation => r.type === "audio");

describe("parseRepresentations", () => {
  describe("dimensions on the AdaptationSet", () => {
    const representations = parseRepresentations(dimensionsOnAdaptationSet);

    test("parses every Representation", () => {
      expect(representations).toHaveLength(3);
      expect(videoOnly(representations)).toHaveLength(2);
      expect(audioOnly(representations)).toHaveLength(1);
    });

    test("inherits width and height from the AdaptationSet", () => {
      expect(videoOnly(representations).map((r) => [r.width, r.height])).toEqual([
        [1280, 720],
        [1280, 720],
      ]);
    });

    test("parses the highest bandwidth video", () => {
      expect(getHighestBandwidth(videoOnly(representations))).toEqual({
        type: "video",
        bandwidth: 1_293_442,
        codecs: "avc1.42c01e",
        mimeType: "video/mp4",
        baseURL: "lqab3314c0f6da15f749a59a0808cccc39.mp4",
        width: 1280,
        height: 720,
      });
    });

    test("parses the audio", () => {
      expect(audioOnly(representations)).toEqual([
        {
          type: "audio",
          bandwidth: 129_859,
          codecs: "mp4a.40.2",
          mimeType: "audio/mp4",
          baseURL: "a_sdab3314c0f6da15f749a59a0808cccc39.mp4",
        },
      ]);
    });
  });

  describe("dimensions on the Representation", () => {
    const representations = parseRepresentations(dimensionsOnRepresentation);

    test("parses every Representation across multiple AdaptationSets", () => {
      expect(representations).toHaveLength(5);
      expect(videoOnly(representations)).toHaveLength(4);
      expect(audioOnly(representations)).toHaveLength(1);
    });

    test("reads width and height per Representation", () => {
      expect(videoOnly(representations).map((r) => [r.width, r.height])).toEqual([
        [1280, 720],
        [1920, 1080],
        [640, 360],
        [854, 480],
      ]);
    });

    test("selects the highest bandwidth video and audio", () => {
      const video = getHighestBandwidth(videoOnly(representations));
      const audio = getHighestBandwidth(audioOnly(representations));

      expect(video?.baseURL).toBe("hd7aa24d3751a1a0448a25e63af3a30a1a.mp4");
      expect(video?.height).toBe(1080);
      expect(audio?.baseURL).toBe("a_lq7aa24d3751a1a0448a25e63af3a30a1a.mp4");
    });
  });

  describe("classification", () => {
    test("keeps audio that declares width and height", () => {
      const [representation] = parseRepresentations(
        wrap('contentType="audio"', 'bandwidth="128000" width="1" height="1"', "a.mp4"),
      );

      expect(representation?.type).toBe("audio");
    });

    test("keeps video without width and height when contentType says video", () => {
      const [representation] = parseRepresentations(
        wrap('contentType="video"', 'bandwidth="128000"', "v.mp4"),
      );

      expect(representation).toEqual({
        type: "video",
        bandwidth: 128_000,
        codecs: null,
        mimeType: null,
        baseURL: "v.mp4",
        width: 0,
        height: 0,
      });
    });

    test("falls back to width and height when contentType is absent", () => {
      const [video] = parseRepresentations(
        wrap("", 'bandwidth="128000" width="640" height="360"', "v.mp4"),
      );
      const [audio] = parseRepresentations(wrap("", 'bandwidth="128000"', "a.mp4"));

      expect(video?.type).toBe("video");
      expect(audio?.type).toBe("audio");
    });
  });

  describe("malformed input", () => {
    test("drops Representations without a BaseURL", () => {
      expect(parseRepresentations(wrap('contentType="video"', 'bandwidth="1"'))).toEqual([]);
    });

    test("returns an empty list for xml without Representations", () => {
      expect(parseRepresentations('<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"/>')).toEqual([]);
    });

    test("defaults a missing bandwidth to 0", () => {
      const [representation] = parseRepresentations(wrap('contentType="audio"', "", "a.mp4"));

      expect(representation?.bandwidth).toBe(0);
    });
  });
});
