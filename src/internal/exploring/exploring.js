const {
  iframe,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  htmlFileRelativeUrl,
  browserRuntimeFileRelativeUrl,
  sourcemapMainFileRelativeUrl,
  sourcemapMappingFileRelativeUrl,
} = window.jsenv

/*
TODOLIST:
- mettre a jour createNodeRuntime pour qu'il aille chercher le bon importmap

- a définir qui gere event-source
a priori compile server parce que sans lui on a rien.
Et le serveur exploring c'est une app différente qui vient se brancher sur compile server
donc il devrait pas avoir a implem event source lui meme.

- utiliser onpopstate pour calculer relativeUrl

- avoir une api pour lister les fichiers explorable
pour ce point on pourrait considérer que fetch / renvoit un json avec le contenu du dossier
et que clientside on décide ce qui est explorable avec une config qu'on peut update quand on veut.
Mais il manquerais le fait qu'on veut pas fetch tous les dossiers des le départ bref a voir

- faire un certificat https avec un custom authority qu'on trust et voir si ça fix les soucis sour chrome

*/

const fileRelativeUrl = "test/startExploring/livereload/livereload.main.js"

const performIframeAction = (action, ...args) => {
  sendMessage({ action, args })

  return new Promise((resolve, reject) => {
    const onMessage = (messageEvent) => {
      const { origin } = messageEvent
      if (origin !== compileServerOrigin) return
      const { data } = messageEvent
      if (typeof data !== "object" || data === null) return

      const { code, value } = data
      if (code === `${action}-failure`) {
        window.removeEventListener("message", onMessage, false)
        reject(value)
      } else if (code === `${action}-completion`) {
        window.removeEventListener("message", onMessage, false)
        resolve(value)
      }
    }

    window.addEventListener("message", onMessage, false)
  })
}

const sendMessage = (data) => {
  console.log(">", data)
  iframe.contentWindow.postMessage(data, compileServerOrigin)
}

iframe.addEventListener(
  "load",
  async () => {
    const result = await performIframeAction("execute", {
      fileRelativeUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      browserRuntimeFileRelativeUrl,
      sourcemapMainFileRelativeUrl,
      sourcemapMappingFileRelativeUrl,
      collectNamespace: true,
      collectCoverage: false,
      executionId: fileRelativeUrl,
    })
    if (result.status === "errored") {
      // eslint-disable-next-line no-eval
      const error = window.eval(result.exceptionSource)
      console.log(`error during execution`, error)
    } else {
      console.log(`execution done`)
    }
  },
  true,
)
iframe.src = `${compileServerOrigin}/${htmlFileRelativeUrl}`
