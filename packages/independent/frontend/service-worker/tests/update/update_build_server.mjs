import { build, startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const buildStory = async (name) => {
  await build({
    handleSIGINT: false,
    logs: { level: "warn" },
    sourceDirectoryUrl: new URL("./project/client/", import.meta.url),
    buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [
      {
        resolveReference: (reference) => {
          if (reference.specifier.includes("animal.svg")) {
            reference.filenameHint = "animal.svg";
            return new URL(`./project/client/${name}.svg`, import.meta.url);
          }
          return null;
        },
      },
    ],
    minification: false,
    injections: {
      "**/sw.js": () => ({
        "self.NAME": name,
      }),
    },
  });
};

await buildStory("dog");

const { certificate, privateKey } = requestCertificate();
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  https: { certificate, privateKey },
  buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
  buildMainFilePath: "main.html",
  routes: [
    {
      endpoint: "GET /update_animal_to_dog",
      fetch: async () => {
        await buildStory("dog");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /update_animal_to_horse",
      fetch: async () => {
        await buildStory("horse");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /update_animal_to_cat",
      fetch: async () => {
        await buildStory("cat");
        return { status: 200 };
      },
    },
    {
      endpoint: "GET /update_animal_to_bear",
      fetch: async () => {
        await buildStory("bear");
        return { status: 200 };
      },
    },
  ],
});
