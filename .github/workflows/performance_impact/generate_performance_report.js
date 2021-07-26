import { measureImportDuration } from "./measure_import_duration/measure_import_duration.js"
import { measureImportMemoryUsage } from "./measure_import_memory_usage/measure_import_memory_usage.js"
import { measureNpmTarball } from "./measure_npm_tarball/measure_npm_tarball.js"
import { measureExploring } from "./measure_exploring/measure_exploring.js"
import { measureBuild } from "./measure_build/measure_build.js"
import { measureTestPlan } from "./measure_test_plan/measure_test_plan.js"

export const generatePerformanceReport = async () => {
  const importDurationMetric = await measureImportDuration()
  const importMemoryHeapUsed = await measureImportMemoryUsage()
  const npmTarballMetrics = await measureNpmTarball()

  const exploringMetrics = await measureExploring()
  const buildMetrics = await measureBuild()
  const testPlanMetrics = await measureTestPlan()

  return {
    groups: {
      "@jsenv/performance-impact package": {
        ...importDurationMetric,
        ...importMemoryHeapUsed,
        ...npmTarballMetrics,
      },
      "starting exploring server": {
        ...exploringMetrics,
      },
      "building a simple project": {
        ...buildMetrics,
      },
      "execute test plan": {
        ...testPlanMetrics,
      },
    },
  }
}

const executeAndLog = process.argv.includes("--log")
if (executeAndLog) {
  const performanceReport = await generatePerformanceReport()
  console.log(JSON.stringify(performanceReport, null, "  "))
}
