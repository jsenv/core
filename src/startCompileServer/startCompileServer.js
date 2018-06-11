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

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  sourceMap = "comment",
  minify = false,
  instrument = false,
}) => {
  const compiledFolderRelativeLocation = "compiled"
  const cacheFolderRelativeLocation = "build"
  // const browserLoaderLocation = `node_modules/@dmail/module-loader/src/browser/index.js`
  // const nodeLoaderLocation = `node_modules/@dmail/module-loader/src/node/index.js`

  const compile = ({ input, inputRelativeLocation, outputRelativeLocation }) => {
    return createCompiler()
      .compile({
        input,
        inputRelativeLocation,
      })
      .then(({ code, map }) => {
        let output = code
        const outputAssets = []

        const appendSourceURL = Boolean(inputRelativeLocation)

        // sourceURL
        // if sourceMap are put as comment do not put sourceURL
        // because it prevent chrome from fetching sourceMappingURL for some reason breaking sourcemaps
        if (appendSourceURL && sourceMap !== "comment") {
          // client thinks we are at compiled/folder/file.js
          const clientLocation = path.resolve(
            rootLocation,
            `${compiledFolderRelativeLocation}/${inputRelativeLocation}`,
          )
          // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
          const serverLocation = path.resolve(rootLocation, outputRelativeLocation)
          // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
          const relativeLocation = path.relative(clientLocation, serverLocation)

          output = writeSourceLocation({ code: output, location: relativeLocation })
        }

        // sourceMap
        if (typeof map === "object") {
          // delete sourceMap.sourcesContent
          // we could remove sources content, they can be fetched from server
          // removing them will decrease size of sourceMap BUT force
          // the client to fetch the source resulting in an additional http request

          // we could delete map.sourceRoot to ensure clientLocation is absolute
          // but it's not set anyway because not passed to babel during compilation

          if (sourceMap === "inline") {
            const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
            output = writeSourceMapLocation({
              code: output,
              location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
            })
          } else if (sourceMap === "comment") {
            // folder/file.js -> file.js.map
            const sourceMapName = `${path.basename(inputRelativeLocation)}.map`

            // client thinks we are at compiled/folder/file.js
            const clientLocation = path.resolve(
              rootLocation,
              `${compiledFolderRelativeLocation}/${inputRelativeLocation}.map`,
            )
            // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
            const serverLocation = `${path.resolve(rootLocation, outputRelativeLocation)}.map`
            // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js.map
            const relativeLocation = path.relative(clientLocation, serverLocation)

            output = writeSourceMapLocation({ code: output, location: relativeLocation })

            outputAssets.push({
              name: sourceMapName,
              content: JSON.stringify(map),
            })
          }
        }

        return {
          output,
          outputAssets,
        }
      })
  }

  const compileService = createCompileService({
    rootLocation,
    cacheFolderRelativeLocation,
    compile,
    sourceMap,
    minify,
    instrument,
    trackHit: true,
  })

  const handler = createResponseGenerator({
    services: [
      (request) => {
        if (request.url.pathname.startsWith(`/${compiledFolderRelativeLocation}`)) {
          const compileURL = new URL(request.url)
          compileURL.pathname = request.url.pathname.slice(
            `/${compiledFolderRelativeLocation}`.length,
          )
          return compileService({
            ...request,
            url: compileURL,
          })
        }
      },
      createFileService({
        locate: ({ url }) => {
          const pathname = url.pathname.slice(1)
          const resolvedUrl = new URL(pathname, `file:///${rootLocation}/`)
          return resolvedUrl
        },
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
    return { close, url, compileURL: new URL(`${compiledFolderRelativeLocation}/`, url) }
  })
}

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
