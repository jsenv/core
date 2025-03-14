// TODO: subbuilds

import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_server.js",
  },
  runtimeCompat: {
    node: "22.13.1",
  },
  directoryReferenceEffect: (reference) => {
    // jsenv server directory url
    if (reference.url === new URL("../", import.meta.url).href) {
      return "resolve";
    }
    return "error";
  },
  scenarioPlaceholders: false,
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "file:///**/node_modules/ws/": true,
        "file:///**/node_modules/emoji-regex/": true,
        "file:///**/node_modules/once/": true,
        "file:///**/node_modules/dezalgo/": true,
      },
    }),
    {
      name: "jsenv_server_internal_client_files_resolver",
      appliesDuring: "*",
      resolveReference: (reference) => {
        if (reference.specifier.startsWith("/@jsenv/server/")) {
          const urlRelativeToJsenvServer = reference.specifier.slice(
            "/@jsenv/server/".length,
          );
          const url = new URL(
            urlRelativeToJsenvServer,
            new URL("../", import.meta.url),
          );
          return url;
        }
        return null;
      },
    },
  ],
  // for debug
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
});
