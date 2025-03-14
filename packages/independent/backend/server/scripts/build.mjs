import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { urlToBasename, urlToFilename } from "@jsenv/urls";

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

const clientFileSubbuild = (clientFileRelativeUrl, options = {}) => {
  const clientFileUrl = import.meta.resolve(`../src/${clientFileRelativeUrl}`);
  const clientFilebasename = urlToBasename(clientFileUrl);
  const clientFilename = urlToFilename(clientFileUrl);
  return {
    buildDirectoryUrl: import.meta.resolve(
      `../dist/client/${clientFilebasename}/`,
    ),
    entryPoints: {
      [`./${clientFileRelativeUrl}`]: clientFilename,
    },
    runtimeCompat: { chrome: "89" },
    bundling: {
      js_module: {
        chunks: false,
      },
    },
    plugins: [jsenvPluginServerInternalClientFilesResolver()],
    ...options,
    // for now the subbuild content won't be written cause
    // it can conflict when there is several build in parallel
    // causing errors like scandir ENOENT
    // (this is because we cleanup the outDirectory for each build)
    // (so we night be removing dir while also trying to write them)
    outDirectoryUrl: null,
  };
};

await build({
  sourceDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/main.js": "jsenv_server.js",
  },
  runtimeCompat: {
    node: "22.13.1",
  },
  subbuilds: [
    clientFileSubbuild("src/services/default_body_4xx_5xx/client/4xx.html"),
    clientFileSubbuild("src/services/error_handler/client/500.html"),
    clientFileSubbuild(
      "src/services/route_inspector/client/route_inspector.html",
      {
        http: true,
      },
    ),
  ],
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
  ],
  // for debug
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
});
