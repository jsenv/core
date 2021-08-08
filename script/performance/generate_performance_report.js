import { measureImport } from "./measure_import/measure_import.js"
import { measureNpmTarball } from "./measure_npm_tarball/measure_npm_tarball.js"
import { measureExploring } from "./measure_exploring/measure_exploring.js"
import { measureBuild } from "./measure_build/measure_build.js"
import { measureTestPlan } from "./measure_test_plan/measure_test_plan.js"

export const generatePerformanceReport = async () => {
  const importMetrics = await measureImport()
  const npmTarballMetrics = await measureNpmTarball()

  const exploringMetrics = await measureExploring()
  const buildMetrics = await measureBuild()
  const testPlanMetrics = await measureTestPlan()

  return {
    groups: {
      "@jsenv/performance-impact package": {
        ...importMetrics,
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
