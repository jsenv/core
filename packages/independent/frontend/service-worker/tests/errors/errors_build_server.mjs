import { build, startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const buildStory = async (story) => {
  await build({
    handleSIGINT: false,
    logs: { level: "warn" },
    sourceDirectoryUrl: new URL("./project/src/", import.meta.url),
    buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [
      {
        resolveReference: (reference) => {
          if (reference.specifier.includes("sw.js")) {
            reference.filenameHint = "sw.js";
            return new URL(`./project/src/sw_${story}.js`, import.meta.url);
          }
          return null;
        },
      },
    ],
    injections: {
      "**/sw_*.js": () => ({
        "self.NAME": story,
      }),
    },
    minification: false,
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
  routes: [
    {
      endpoint: "GET /build_no_error",
      fetch: async () => {
        await buildStory("no_error");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /build_error_during_register",
      fetch: async () => {
        await buildStory("error_during_register");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /build_error_during_install",
      fetch: async () => {
        await buildStory("error_during_install");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /build_error_during_activate",
      fetch: async () => {
        await buildStory("error_during_activate");
        return { status: 200 };
      },
    },
  ],
});
