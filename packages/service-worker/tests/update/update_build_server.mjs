import { build, startBuildServer } from "@jsenv/core"
import { requestCertificate } from "@jsenv/https-local"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginGlobals } from "@jsenv/plugin-globals"

const buildStory = async (name) => {
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
        resolveUrl: (reference) => {
          if (reference.specifier.includes("animal.svg")) {
            reference.filename = "animal.svg"
            return new URL(`./project/src/${name}.svg`, import.meta.url)
          }
          return null
        },
      },
      jsenvPluginGlobals({
        "**/sw.js": () => ({
          NAME: name,
        }),
      }),
    ],
  })
}

await buildStory("dog")

const { certificate, privateKey } = requestCertificate()
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  https: { certificate, privateKey },
  buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
  buildMainFilePath: "main.html",
  services: [
    {
      handleRequest: async (request) => {
        if (request.pathname === "/update_animal_to_dog") {
          await buildStory("dog")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_horse") {
          await buildStory("horse")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_cat") {
          await buildStory("cat")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_bear") {
          await buildStory("bear")
          return { status: 200 }
        }
        return null
      },
    },
  ],
})
