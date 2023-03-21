import { writeFileSync } from "node:fs"

import { startJsCoverage } from "./profiler_v8_coverage.js"
import { startObservingPerformances } from "./node_execution_performance.js"

export const executeUsingDynamicImport = async ({
  sourceDirectoryUrl,
  fileUrl,
  collectPerformance,
  coverageEnabled,
  coverageConfig,
  coverageMethodForNodeJs,
  coverageFileUrl,
}) => {
  const result = {}
  const afterImportCallbacks = []
  if (coverageEnabled && coverageMethodForNodeJs === "Profiler") {
    const { filterV8Coverage } = await import(
      "@jsenv/core/src/test/coverage/v8_coverage.js"
    )
    const { stopJsCoverage } = await startJsCoverage()
    afterImportCallbacks.push(async () => {
      const coverage = await stopJsCoverage()
      const coverageLight = await filterV8Coverage(coverage, {
        sourceDirectoryUrl,
        coverageConfig,
      })
      writeFileSync(
        new URL(coverageFileUrl),
        JSON.stringify(coverageLight, null, "  "),
      )
    })
  }
  if (collectPerformance) {
    const getPerformance = startObservingPerformances()
    afterImportCallbacks.push(async () => {
      const performance = await getPerformance()
      result.performance = performance
    })
  }
  const namespace = await import(fileUrl)
  const namespaceResolved = {}
  await Promise.all(
    Object.keys(namespace).map(async (key) => {
      const value = await namespace[key]
      namespaceResolved[key] = value
    }),
  )
  result.namespace = namespaceResolved
  await afterImportCallbacks.reduce(async (previous, afterImportCallback) => {
    await previous
    await afterImportCallback()
  }, Promise.resolve())
  return result
}
