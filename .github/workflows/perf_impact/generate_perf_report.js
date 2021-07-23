import { measurePerformanceMultipleTimes, computeMetricsMedian } from "@jsenv/perf-impact"

import { performanceFromFile } from "./performance_file.js"
// import { collectWorkerMessages } from "./worker_messages.js"

const executeAndLog = process.argv.includes("--log")

export const generatePerformanceReport = async () => {
  const importingPackageMetrics = await measureImportingJsenvCorePackage()

  return {
    "key metrics": {
      ...importingPackageMetrics,
    },
  }
}

const measureImportingJsenvCorePackage = async () => {
  const fileUrl = new URL("./measure_importing_jsenv_core_package.js", import.meta.url)
  // const fileUrl = new URL("./job_measure_importing_jsenv_core_package.js", import.meta.url)
  const metrics = await measurePerformanceMultipleTimes(
    async () => {
      const { measures } = await performanceFromFile(fileUrl)
      return measures
      // const messages = await collectWorkerMessages(fileUrl)
      // return {
      //   "import @jsenv/core": messages[0],
      // }
    },
    10,
    {
      msToWaitBetweenEachMeasure: 200,
    },
  )
  if (executeAndLog) {
    console.log(metrics)
  }
  return computeMetricsMedian(metrics)
}

if (executeAndLog) {
  const performanceReport = await generatePerformanceReport()
  console.log(performanceReport)
}
