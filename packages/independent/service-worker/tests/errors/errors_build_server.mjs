import { build, startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginGlobals } from "@jsenv/plugin-globals";

const buildStory = async (story) => {
  await build({
    handleSIGINT: false,
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./project/src/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
    plugins: [
      jsenvPluginBundling(),
      {
        resolveReference: (reference) => {
          if (reference.specifier.includes("sw.js")) {
            reference.filename = "sw.js";
            return new URL(`./project/src/sw_${story}.js`, import.meta.url);
          }
          return null;
        },
      },
      jsenvPluginGlobals({
        "**/sw_*.js": () => ({
          NAME: story,
        }),
      }),
    ],
  });
};

await buildStory("no_error");

const { certificate, privateKey } = requestCertificate();
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  https: { certificate, privateKey },
  buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
  buildMainFilePath: "main.html",
  services: [
    {
      handleRequest: async (request) => {
        if (request.pathname === "/build_no_error") {
          await buildStory("no_error");
          return { status: 200 };
        }
        if (request.pathname === "/build_error_during_register") {
          await buildStory("error_during_register");
          return { status: 200 };
        }
        if (request.pathname === "/build_error_during_install") {
          await buildStory("error_during_install");
          return { status: 200 };
        }
        if (request.pathname === "/build_error_during_activate") {
          await buildStory("error_during_activate");
          return { status: 200 };
        }
        return null;
      },
    },
  ],
});
