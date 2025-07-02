import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

const jsenvPluginServerInternalClientFilesResolver = () => {
  return {
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
  };
};

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"), // for debug
  entryPoints: {
    "./src/main.js": {
      buildRelativeUrl: "./jsenv_server.js",
      runtimeCompat: { node: "22.13.1" },
      directoryReferenceEffect: {
        [import.meta.resolve("../")]: "resolve",
        "**/*": "error",
      },
      scenarioPlaceholders: false,
      plugins: [
        jsenvPluginCommonJs({
          include: {
            "ws/": true,
            "once/": true,
            "dezalgo/": true,
            "@paralleldrive/cuid2/": true,
          },
        }),
      ],
    },
    "./src/services/default_body_4xx_5xx/client/4xx.html": {
      buildRelativeUrl: "./client/default_body_4xx_5xx/4xx.html",
      runtimeCompat: { chrome: "89" },
      plugins: [jsenvPluginServerInternalClientFilesResolver()],
    },
    "./src/services/error_handler/client/500.html": {
      buildRelativeUrl: "./client/error_handler/500.html",
      runtimeCompat: { chrome: "89" },
      plugins: [jsenvPluginServerInternalClientFilesResolver()],
    },
    "./src/services/route_inspector/client/route_inspector.html": {
      buildRelativeUrl: "./client/route_inspector/route_inspector.html",
      runtimeCompat: { chrome: "89" },
      plugins: [jsenvPluginServerInternalClientFilesResolver()],
      http: true,
    },
  },
});
