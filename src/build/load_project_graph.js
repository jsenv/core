import { createLog, startSpinner, UNICODE } from "@jsenv/log"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { loadUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph_load.js"
import { createUrlGraphSummary } from "@jsenv/core/src/utils/url_graph/url_graph_report.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { msAsDuration } from "@jsenv/core/src/utils/logs/duration_log.js"

export const loadProjectGraph = async ({
  signal,
  logger,
  projectDirectoryUrl,
  entryUrls,

  plugins,
  runtimeSupport,
  sourcemapInjection,
}) => {
  const urlGraph = createUrlGraph({
    projectDirectoryUrl,
    scenario: "build",
  })
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    plugins,
    runtimeSupport,
    sourcemapInjection,
    urlGraph,
    scenario: "build",
  })
  const startMs = Date.now()
  const buildingLog = createLog()
  const spinner = startSpinner({
    log: buildingLog,
    text: `Loading project graph`,
  })
  let urlCount = 0
  try {
    await loadUrlGraph({
      urlGraph,
      entryUrls,
      rootDirectoryUrl: projectDirectoryUrl,
      kitchen,
      onCooked: () => {
        urlCount++
        spinner.text = `Loading project graph ${urlCount}`
      },
    })
  } catch (e) {
    spinner.stop(`${UNICODE.FAILURE} Failed to load project graph`)
    throw e
  }
  // here we can perform many checks such as ensuring ressource hints are used
  const msEllapsed = Date.now() - startMs
  spinner.stop(
    `${UNICODE.OK} project graph loaded in ${msAsDuration(msEllapsed)}`,
  )
  logger.info(createUrlGraphSummary(urlGraph))
  return urlGraph
}
