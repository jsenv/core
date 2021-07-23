import { execute, launchNode } from "@jsenv/core"
import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/perf-impact"

export const generatePerformanceReport = async () => {
  const importingPackageMetrics = await measureImportingJsenvCorePackage()

  return {
    "key metrics": {
      ...importingPackageMetrics,
    },
  }
}

const measureImportingJsenvCorePackage = async () => {
  const metrics = await measurePerformanceMultipleTimes(() => {
    return collectPerformanceMeasuresFromFileExecution("measure_importing_jsenv_core_package")
  })
  return computeMetricsMedian(metrics)
}

const collectPerformanceMeasuresFromFileExecution = async (fileRelativeUrl) => {
  const executionResult = await execute({
    projectDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl,
    launch: launchNode,
    // measurePerformance: true,
    compileServerCanWriteOnFilesystem: false,
    collectPerformance: true,
  })
  return executionResult.performance.measures
}

const performanceReport = await generatePerformanceReport()
console.log(performanceReport)
