import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import { createFileService } from "../createFileService/index.js"
import { createCompiler } from "../compiler/createCompiler.js"
import { URL } from "url"
import path from "path"
import { createCompileService } from "../createCompileService/index.js"

const writeSourceLocation = ({ code, location }) => {
  return `${code}
//# sourceURL=${location}`
}

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

export const startCompileServer = ({ url, rootLocation, cors = true }) => {
  const cacheFolderRelativeLocation = "build"
  const browserLoaderLocation = `node_modules/@dmail/module-loader/src/browser/index.js`
  const nodeLoaderLocation = `node_modules/@dmail/module-loader/src/node/index.js`

  const compile = ({ input, inputRelativeLocation }) => {
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
          const sourceMapRelativeLocation = `${path.dirname(
            inputRelativeLocation,
          )}/${sourceMapName}`
          const sourceMapClientLocation = `${cacheFolderRelativeLocation}/${sourceMapRelativeLocation}`
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

  const handler = createResponseGenerator({
    services: [
      createFileService({
        include: ({ pathname }) => {
          const relativeFilename = pathname.slice(1)

          if (
            relativeFilename === browserLoaderLocation ||
            relativeFilename === nodeLoaderLocation
          ) {
            return true
          }

          const extname = path.extname(pathname)
          if (extname === ".js" || extname === ".mjs") {
            if (relativeFilename.startsWith(`${cacheFolderRelativeLocation}/`)) {
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
          const resolvedUrl = new URL(pathname, `file:///${rootLocation}/`)
          return resolvedUrl
        },
      }),
      createCompileService({
        rootLocation,
        cacheFolderRelativeLocation,
        compile,
        outputMeta: {}, // options we want to support are minify AND instrument
        trackHit: true,
      }),
    ],
  })

  return startServer({ url }).then(({ url, addRequestHandler, close }) => {
    const nodeRequestHandler = createNodeRequestHandler({
      handler,
      url,
      transform: (response) => {
        return cors ? enableCORS(response) : response
      },
    })
    addRequestHandler(nodeRequestHandler)
    return { close, url }
  })
}

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
