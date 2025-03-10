import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.js": "jsenv_server.js",
  },
  ignore: {
    "file://**/node_modules/": true,
    // selectively unignore some node_modules
    "file://**/node_modules/@jsenv/abort/": false,
    "file://**/node_modules/@jsenv/humanize/": false,
    "file://**/node_modules/@jsenv/url-meta/": false,
    "file://**/node_modules/@jsenv/urls/": false,
    "file://**/node_modules/@jsenv/utils/": false,
    "file://**/node_modules/@jsenv/filesystem/": false,
    "file://**/node_modules/@jsenv/router/": false,
    "file://**/node_modules/@jsenv/assert/": false,
    "file://**/node_modules/ws/": false,
    "file://**/node_modules/ansi-escapes/": false,
    "file://**/node_modules/is-unicode-supported/": false,
    "file://**/node_modules/supports-color/": false,
    "file://**/node_modules/environment/": false,
    "file://**/node_modules/string-width/": false,
    "file://**/node_modules/strip-ansi/": false,
    "file://**/node_modules/get-east-asian-width/": false,
    "file://**/node_modules/emoji-regex/": false,
    "file://**/node_modules/ansi-regex/": false,
    "file://**/node_modules/formidable/": false,
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
