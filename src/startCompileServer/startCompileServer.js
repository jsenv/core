import { createResponseGenerator } from "../startServer/createResponseGenerator.js"
import { createNodeRequestHandler, enableCORS } from "../startServer/createNodeRequestHandler.js"
import { startServer } from "../startServer/startServer.js"
import { createFileService } from "../createFileService/index.js"
import { createCompiler } from "../compiler/createCompiler.js"
import { URL } from "url"
import path from "path"
import { createCompileService } from "../createCompileService/index.js"

// const writeSourceLocation = ({ code, location }) => {
//   return `${code}
// //# sourceURL=${location}`
// }

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

export const startCompileServer = ({
  url,
  rootLocation,
  cors = true,
  sourceMap = "comment",
  // comment sourceMap are not working because browser will try to fetch sthing like
  // http://127.0.0.1/67676/build/src/__test__/file.js.map
  // but the real location is
  // http://127.0.0.1/67676/build/src/__test__/file.js.map/jskldjdklsjkjdlk/file.js.map
  // I have to figure how to fix this
  // maybe sourceURL should tell where is really the file
  // and sourceMappingURL too
  // yeah I'll go for that
  // to avoid inline sourcemap
  // we may try to load script using <script> tag in browser instead of XMLHttpRequest ?
  minify = false,
  instrument = false,
}) => {
  const cacheFolderRelativeLocation = "build"
  // const browserLoaderLocation = `node_modules/@dmail/module-loader/src/browser/index.js`
  // const nodeLoaderLocation = `node_modules/@dmail/module-loader/src/node/index.js`

  const compile = ({ input, inputRelativeLocation }) => {
    // const locateSourceFromCompiledLocation = () => {
    //   const compiledLocation = `${rootLocation}/${cacheFolderRelativeLocation}/${inputRelativeLocation}`
    //   const sourceLocation = `${rootLocation}/${inputRelativeLocation}`
    //   return path.relative(compiledLocation, sourceLocation)
    // }

    return createCompiler()
      .compile({
        input,
        inputRelativeLocation,
      })
      .then(({ code, map }) => {
        let output = code
        const outputAssets = []

        // sourceURL
        // not really required because when we ask for build/file.js
        // the file is actually at build/file.js no need to fake that
        // if (inputRelativeLocation) {
        //   const sourceClientLocation = locateSourceFromCompiledLocation()
        //   output = writeSourceLocation({ code: output, location: sourceClientLocation })
        // }

        // sourceMap
        if (typeof map === "object") {
          // delete sourceMap.sourcesContent
          // we could remove sources content, they can be fetched from server
          // removing them will decrease size of sourceMap BUT force
          // the client to fetch the source resulting in an additional http request

          if (sourceMap === "inline") {
            const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
            output = writeSourceMapLocation({
              code: output,
              location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
            })
          } else if (sourceMap === "comment") {
            const sourceMapName = `${path.basename(
              inputRelativeLocation,
              path.extname(inputRelativeLocation),
            )}.map`

            const sourceMapClientLocation = `./${sourceMapName}`
            // we could delete sourceMap.sourceRoot to ensure clientLocation is absolute
            // but it's not set anyway because not passed to babel during compilation
            output = writeSourceMapLocation({ code: output, location: sourceMapClientLocation })

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

  const handler = createResponseGenerator({
    services: [
      createCompileService({
        rootLocation,
        cacheFolderRelativeLocation,
        compile,
        sourceMap,
        minify,
        instrument,
        trackHit: true,
      }),
      createFileService({
        // include: ({ pathname }) => {
        //   const relativeFilename = pathname.slice(1)

        //   if (
        //     relativeFilename === browserLoaderLocation ||
        //     relativeFilename === nodeLoaderLocation
        //   ) {
        //     return true
        //   }

        //   const extname = path.extname(pathname)
        //   if (extname === ".js" || extname === ".mjs") {
        //     if (relativeFilename.startsWith(`${cacheFolderRelativeLocation}/`)) {
        //       return true
        //     }
        //     return false
        //   }
        //   return true
        // },
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
    return { close, url, cacheURL: new URL(`${cacheFolderRelativeLocation}/`, url) }
  })
}

// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js
