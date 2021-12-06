import {
  resolveUrl,
  urlToFilename,
  urlToParentUrl,
  writeFile,
} from "@jsenv/filesystem"

import {
  readWorkerFile,
  transformWorker,
} from "@jsenv/core/src/internal/building/worker/transform_worker.js"
import { minifyJs } from "@jsenv/core/src/internal/building/js/minifyJs.js"
import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

export const buildWorkers = async ({
  workers,
  projectDirectoryUrl,
  buildDirectoryUrl,
  replacePlaceholders,
  minify,
}) => {
  await Promise.all(
    Object.keys(workers).map(async (workerProjectRelativeUrl) => {
      const workerBuildRelativeUrl = workers[workerProjectRelativeUrl]
      const workerProjectUrl = resolveUrl(
        workerProjectRelativeUrl,
        projectDirectoryUrl,
      )
      const workerBuildUrl = resolveUrl(
        workerBuildRelativeUrl,
        buildDirectoryUrl,
      )
      await buildWorker({
        workerProjectUrl,
        workerBuildUrl,
        replacePlaceholders,
        minify,
      })
    }),
  )
}

const buildWorker = async ({
  workerProjectUrl,
  workerBuildUrl,
  replacePlaceholders,
  minify,
}) => {
  const url = workerProjectUrl
  let code = readWorkerFile(url)
  let map
  const workerBundle = await transformWorker({
    url,
    code,
  })
  code = workerBundle.code
  map = workerBundle.map

  code = replacePlaceholders(code)

  if (minify) {
    const minifyResult = await minifyJs({
      url,
      code,
      map,
      sourcemapIncludeSources: true,
    })
    code = minifyResult.code
    map = minifyResult.map
  }

  await writeWorkerJsAndSourcemap({
    workerBuildUrl,
    code,
    map,
  })
}

const writeWorkerJsAndSourcemap = async ({ workerBuildUrl, code, map }) => {
  const filename = urlToFilename(workerBuildUrl)
  const sourcemapFilename = `${filename}.map`
  const sourcemapBuildUrl = `${urlToParentUrl(
    workerBuildUrl,
  )}${sourcemapFilename}`
  code = setJavaScriptSourceMappingUrl(code, sourcemapFilename)
  await Promise.all([
    writeFile(workerBuildUrl, code),
    writeFile(sourcemapBuildUrl, JSON.stringify(map, null, "  ")),
  ])
}
