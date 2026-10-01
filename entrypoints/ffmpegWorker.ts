// `@ffmpeg/ffmpeg/worker`'s declarations start with
// `/// <reference no-default-lib="true" />`, which drops the default `lib` from the whole
// program, so these have to be restored. Keep them in sync with the `lib` that
// `wxt prepare` generates in `.wxt/tsconfig.json`.
/// <reference lib="esnext" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import "@ffmpeg/ffmpeg/worker";

// The ffmpeg worker has to be a file inside the extension. During development WXT serves
// the entrypoints from the dev server, and a worker loaded over http has a different
// origin than the page, so it cannot import the packaged ffmpeg core. Bundling the worker
// as its own entrypoint keeps `browser.runtime.getURL` pointing at the extension in both
// dev and production.
export default defineUnlistedScript(() => {});
