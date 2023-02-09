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
    "./**/sw.js": false,
  },
  clientAutoreload: true,
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
        }
        if (request.pathname === "/update_animal_to_horse") {
          updateAnimal("horse")
        }
        if (request.pathname === "/update_animal_to_cat") {
          updateAnimal("cat")
        }
        if (request.pathname === "/update_sw_script") {
          // the goal will be to ensure this is detected and
          // browser will reload in that scenario
          const swFileUrl = new URL("./client/sw.js", import.meta.url)
          const swFileContent = readFileSync(swFileUrl, "utf8")
          writeFileSync(swFileUrl, `${swFileContent}\n`)
        }
      },
    },
  ],
})

const updateAnimal = (name) => {
  const htmlFileUrl = new URL("./client/main.html", import.meta.url)
  const swFileUrl = new URL("./client/sw.js", import.meta.url)
  const animalFileUrl = new URL("./client/animal.svg", import.meta.url)
  const dogFileUrl = new URL("./client/dog.svg", import.meta.url)

  writeFileSync(animalFileUrl, readFileSync(dogFileUrl))
  const htmlFileContent = readFileSync(htmlFileUrl, "utf8")
  const swFileContent = readFileSync(swFileUrl, "utf8")
  writeFileSync(
    htmlFileUrl,
    htmlFileContent
      .replace("animal.svg?v=cat", `animal.svg?v=${name}`)
      .replace("animal.svg?v=dog", `animal.svg?v=${name}`)
      .replace("animal.svg?v=horse", `animal.svg?v=${name}`),
  )
  writeFileSync(
    swFileUrl,
    swFileContent
      .replace("animal.svg?v=cat", `animal.svg?v=${name}`)
      .replace("animal.svg?v=dog", `animal.svg?v=${name}`)
      .replace("animal.svg?v=horse", `animal.svg?v=${name}`),
  )
}
