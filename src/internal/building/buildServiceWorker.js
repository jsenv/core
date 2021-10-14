import {
  resolveUrl,
  urlToFilename,
  writeFile,
  urlToParentUrl,
} from "@jsenv/filesystem"

import { minifyJs } from "@jsenv/core/src/internal/building/js/minifyJs.js"
import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { bundleWorker } from "./bundleWorker.js"

export const buildServiceWorker = async ({
  projectDirectoryUrl,
  buildDirectoryUrl,
  serviceWorkerProjectRelativeUrl,
  serviceWorkerBuildRelativeUrl = serviceWorkerProjectRelativeUrl,
  minify = false,
  serviceWorkerTransformer = (code) => code,
}) => {
  const serviceWorkerProjectUrl = resolveUrl(
    serviceWorkerProjectRelativeUrl,
    projectDirectoryUrl,
  )
  const serviceWorkerBuildUrl = resolveUrl(
    serviceWorkerBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const workerBundle = bundleWorker({
    workerScriptUrl: serviceWorkerProjectUrl,
  })
  const serviceWorkerCode = serviceWorkerTransformer(workerBundle.code)

  if (minify) {
    const minifyResult = await minifyJs({
      url: serviceWorkerProjectUrl,
      code: serviceWorkerCode,
      map: workerBundle.map,
      sourcemapIncludeSources: true,
    })
    await writeJsAndSourcemap(
      serviceWorkerBuildUrl,
      minifyResult.code,
      minifyResult.map,
    )
  } else {
    await writeJsAndSourcemap(
      serviceWorkerBuildUrl,
      serviceWorkerCode,
      workerBundle.map,
    )
  }
}

const writeJsAndSourcemap = async (
  serviceWorkerBuildUrl,
  serviceWorkerCode,
  serviceWorkerSourceMap,
) => {
  const filename = urlToFilename(serviceWorkerBuildUrl)
  const sourcemapFilename = `${filename}.map`
  const sourcemapBuildUrl = `${urlToParentUrl(
    serviceWorkerBuildUrl,
  )}${sourcemapFilename}`
  serviceWorkerCode = setJavaScriptSourceMappingUrl(
    serviceWorkerCode,
    sourcemapFilename,
  )
  await Promise.all([
    writeFile(serviceWorkerBuildUrl, serviceWorkerCode),
    writeFile(
      sourcemapBuildUrl,
      JSON.stringify(serviceWorkerSourceMap, null, "  "),
    ),
  ])
}
