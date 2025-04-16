import { build, startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const buildStory = async (story) => {
  await build({
    handleSIGINT: false,
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./project/src/"),
    buildDirectoryUrl: import.meta.resolve("./project/dist/"),
    entryPoints: {
      "./main.html": {
        plugins: [
          {
            resolveReference: (reference) => {
              if (reference.specifier.includes("sw.js")) {
                reference.filenameHint = "sw.js";
                return import.meta.resolve(`./project/src/sw_${story}.js`);
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
      },
    },
  });
};

await buildStory("no_error");

const { certificate, privateKey } = requestCertificate();
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  https: { certificate, privateKey },
  buildDirectoryUrl: import.meta.resolve("./project/dist/"),
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
