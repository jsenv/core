export const generatePerformanceReport = async () => {
  const { measureNpmTarball } = await import(
    "./measure_npm_tarball/measure_npm_tarball.js"
  )
  const { measureDevServer } = await import(
    "./measure_dev_server/measure_dev_server.js"
  )
  const { measureBuild } = await import("./measure_build/measure_build.js")
  const { measureTestPlan } = await import(
    "./measure_test_plan/measure_test_plan.js"
  )

  const npmTarballMetrics = await measureNpmTarball()
  const devServerMetrics = await measureDevServer()
  const buildMetrics = await measureBuild()
  const testPlanMetrics = await measureTestPlan()

  return {
    groups: {
      "package metrics": {
        ...npmTarballMetrics,
      },
      "dev server metrics": {
        ...devServerMetrics,
      },
      "build metrics": {
        ...buildMetrics,
      },
      "test metrics": {
        ...testPlanMetrics,
      },
    },
  }
}

const executeAndLog = process.argv.includes("--local")
if (executeAndLog) {
  await import("./measure_npm_tarball/measure_npm_tarball.js")
  await import("./measure_dev_server/measure_dev_server.js")
  await import("./measure_build/measure_build.js")
  await import("./measure_test_plan/measure_test_plan.js")
}
