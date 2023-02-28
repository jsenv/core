import { build, startBuildServer } from "@jsenv/core"
import { requestCertificate } from "@jsenv/https-local"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginGlobals } from "@jsenv/plugin-globals"

const buildAnimal = async (name) => {
  await build({
    handleSIGINT: false,
    logLevel: "warn",
    rootDirectoryUrl: new URL("./project/src/", import.meta.url),
    buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
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

await buildAnimal("dog")

const { certificate, privateKey } = requestCertificate()
export const buildServer = await startBuildServer({
  logLevel: "warn",
  serverLogLevel: "warn",
  protocol: "https",
  certificate,
  privateKey,
  rootDirectoryUrl: new URL("./project/src/", import.meta.url),
  buildDirectoryUrl: new URL("./project/dist/", import.meta.url),
  buildIndexPath: "main.html",
  services: [
    {
      handleRequest: async (request) => {
        if (request.pathname === "/update_animal_to_dog") {
          await buildAnimal("dog")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_horse") {
          await buildAnimal("horse")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_cat") {
          await buildAnimal("cat")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_bear") {
          await buildAnimal("bear")
          return { status: 200 }
        }
        return null
      },
    },
  ],
})
console.log(buildServer.origin)
