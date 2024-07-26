import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { readFileSync } from "node:fs";

await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "main.html",
  },
  bundling: false,
  minification: false,
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
});
const { start_url, icons } = JSON.parse(
  String(
    readFileSync(new URL("./dist/other/manifest.webmanifest", import.meta.url)),
  ),
);
const actual = {
  start_url,
  icons,
};
const expect = {
  start_url: "/",
  icons: [
    {
      src: "/other/pwa.icon.png?v=eece115e",
      sizes: "192x192",
      type: "image/png",
    },
  ],
};
assert({ actual, expect });
