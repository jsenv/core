import { readFileSync, writeFileSync } from "node:fs"
import { startTestServer } from "@jsenv/pwa/tests/start_test_server.mjs"

await startTestServer({
  logLevel: "info",
  serverLogLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
    "./**/main.html": false,
    "./**/animal.svg": false,
    "./**/sw.js": false,
  },
  clientAutoreload: false,
  cacheControl: false,
  explorer: {
    groups: {
      client: {
        "./*.html": true,
      },
    },
  },
  services: [
    {
      name: "test",
      handleRequest: (request) => {
        if (request.pathname === "/update_animal_to_dog") {
          updateAnimal("dog")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_horse") {
          updateAnimal("horse")
          return { status: 200 }
        }
        if (request.pathname === "/update_animal_to_cat") {
          updateAnimal("cat")
          return { status: 200 }
        }
        if (request.pathname === "/update_sw_script") {
          // the goal will be to ensure this is detected and
          // browser will reload in that scenario
          const swFileUrl = new URL("./client/sw.js", import.meta.url)
          const swFileContent = readFileSync(swFileUrl, "utf8")
          writeFileSync(swFileUrl, `${swFileContent}\n`)
          return { status: 200 }
        }
        return null
      },
    },
  ],
})

const updateAnimal = (name) => {
  const htmlFileUrl = new URL("./client/main.html", import.meta.url)
  const swFileUrl = new URL("./client/sw.js", import.meta.url)
  const animalFileUrl = new URL("./client/animal.svg", import.meta.url)
  const newAnimalFileUrl = new URL(`./client/${name}.svg`, import.meta.url)

  writeFileSync(animalFileUrl, readFileSync(newAnimalFileUrl))
  const htmlFileContent = readFileSync(htmlFileUrl, "utf8")
  const swFileContent = readFileSync(swFileUrl, "utf8")
  writeFileSync(
    htmlFileUrl,
    htmlFileContent
      .replaceAll("animal.svg?v=cat", `animal.svg?v=${name}`)
      .replaceAll("animal.svg?v=dog", `animal.svg?v=${name}`)
      .replaceAll("animal.svg?v=horse", `animal.svg?v=${name}`),
  )
  writeFileSync(
    swFileUrl,
    swFileContent
      .replaceAll("animal.svg?v=cat", `animal.svg?v=${name}`)
      .replaceAll("animal.svg?v=dog", `animal.svg?v=${name}`)
      .replaceAll("animal.svg?v=horse", `animal.svg?v=${name}`),
  )
}
