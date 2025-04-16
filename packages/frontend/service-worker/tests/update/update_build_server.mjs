import { build, startBuildServer } from "@jsenv/core";
import { requestCertificate } from "@jsenv/https-local";

const buildStory = async (name) => {
  await build({
    handleSIGINT: false,
    logs: { level: "warn" },
    sourceDirectoryUrl: import.meta.resolve("./project/client/"),
    buildDirectoryUrl: import.meta.resolve("./project/dist/"),
    entryPoints: {
      "./main.html": {
        plugins: [
          {
            resolveReference: (reference) => {
              if (reference.specifier.includes("animal.svg")) {
                reference.filenameHint = "animal.svg";
                return import.meta.resolve(`./project/client/${name}.svg`);
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
      },
    },
  });
};

await buildStory("dog");

const { certificate, privateKey } = requestCertificate();
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  https: { certificate, privateKey },
  buildDirectoryUrl: import.meta.resolve("./project/dist/"),
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
