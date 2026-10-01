import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifestVersion: 3,
  webExt: {
    startUrls: ["https://www.cda.pl/video/13054129d3"],
    // startUrls: ["https://www.cda.pl/video/3220268915/vfilm"],
    chromiumArgs: ["--auto-open-devtools-for-tabs"],
  },
  manifest: {
    name: "CDA Pobieracz",
    permissions: ["downloads", "tabs"],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
});
