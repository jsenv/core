import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import {
  // convertFileSystemErrorToResponseProperties,
  createFileService,
} from "../startServer/createFileService.js"
import { createCompiler } from "../compiler/createCompiler.js"
import { URL } from "url"
import path from "path"
import { resolvePath } from "./createDynamicFileSystem/helpers.js"
import { read } from "./createDynamicFileSystem/index.js"

const createIndexService = ({ indexPathname }) => {
  return ({ url }) => {
    // bad idea we should send a redirect
    const relativeLocation = url.pathname.slice(1)
    if (relativeLocation.length === 0) {
      url.pathname = indexPathname
    }
  }
}

const writeSourceLocation = ({ code, location }) => {
  return `${code}
//# sourceURL=${location}`
}

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

const transform = ({ input, inputRelativeLocation, cacheFolderRelativeLocation }) => {
  return createCompiler()
    .compile({
      input,
      inputRelativeLocation,
    })
    .then(({ code, map }) => {
      let output = code
      const outputAssets = []

      // sourceURL
      if (inputRelativeLocation) {
        const sourceClientLocation = `/${inputRelativeLocation}`
        output = writeSourceLocation({ code: output, location: sourceClientLocation })
      }

      // sourceMap
      if (typeof map === "object") {
        // delete sourceMap.sourcesContent
        // we could remove sources content, they can be fetched from server
        // but removing them will decrease size of sourceMap but force
        // the client to fetch the source resulting in an additional http request

        // the client wont be able to fecth a sourceMapServerLocation like
        // /Users/damien/dev/github/dev-server/src/__test__/build/transpiled/file.js
        // so assuming server serve file at /Users/damien/dev/github/dev-server/src/__test__ it becomes
        // /build/transpiled/file.js
        const sourceMapName = `${path.basename(
          inputRelativeLocation,
          path.extname(inputRelativeLocation),
        )}.map`
        const sourceMapRelativeLocation = resolvePath(
          path.dirname(inputRelativeLocation),
          sourceMapName,
        )
        // const sourceMapServerLocation = resolvePath(rootLocation, sourceMapRelativeLocation)
        const sourceMapClientLocation = resolvePath(
          cacheFolderRelativeLocation,
          sourceMapRelativeLocation,
        )
        // we could delete sourceMap.sourceRoot to ensure clientLocation is absolute
        // but it's not set anyway because not passed to babel during compilation

        writeSourceMapLocation({ code: output, location: sourceMapClientLocation })

        outputAssets.push({
          name: sourceMapName,
          content: JSON.stringify(map),
        })
      }

      return {
        output,
        outputAssets,
      }
    })
}

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  indexLocation = "index.html",
}) => {
  const cacheFolderRelativeLocation = "build"
  // const loaderRelativeLocation = 'createLoader.js'

  const handler = createResponseGenerator({
    services: [
      createIndexService({ indexPathname: indexLocation }),
      createFileService({
        include: ({ pathname }) => {
          const extname = path.extname(pathname)
          if (extname === ".js" || extname === ".mjs") {
            if (pathname.startsWith(`/${cacheFolderRelativeLocation}/`)) {
              return true
            }
            return false
          }
          return true
        },
        locate: ({ url }) => {
          const pathname = url.pathname.slice(1)
          // I don't understand why I have to do this at all
          // disable until I figure this out again
          // html file are not in dist/*
          // if (location.endsWith("/dist") && pathname.endsWith(".html")) {
          //   const sourceLocation = location.slice(0, -"/dist".length)
          //   return new URL(pathname, `file:///${sourceLocation}/`)
          // }
          return new URL(pathname, `file:///${location}/`)
        },
      }),
      ({ method, url }) => {
        if (method !== "GET" && method !== "HEAD") {
          return { status: 501 }
        }

        const inputRelativeLocation = url.pathname.slice(1)
        // si jamais y'a des erreurs filesystem pendant le read
        // faudrait les convertir en 404, 403 etc
        // faudra aussi supporter si le client envoie des cache headers comme if-modified-since
        return read({
          rootLocation,
          inputRelativeLocation,
          cacheFolderRelativeLocation,
          generate: (input) => transform({ input }),
          outputMeta: {},
          trackHit: true,
        }).then(({ output }) => {
          return {
            status: 200,
            headers: {
              "content-length": Buffer.byteLength(output),
              "cache-control": "no-cache",
            },
            body: output,
          }
        })
      },
    ],
  })

  return startServer({ url }).then(({ url, addRequestHandler, close }) => {
    const nodeRequestHandler = createNodeRequestHandler({
      handler,
      url,
      transform: (response) => {
        if (cors) {
          enableCORS(response.headers)
        }
        return response
      },
    })
    addRequestHandler(nodeRequestHandler)
    return { close, url }
  })
}

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
