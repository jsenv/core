export const generatePerformanceReport = async () => {
  const { measureImport } = await import("./measure_import/measure_import.js")
  const { measureNpmTarball } = await import(
    "./measure_npm_tarball/measure_npm_tarball.js"
  )
  const { measureExploring } = await import(
    "./measure_exploring/measure_exploring.js"
  )
  const { measureBuild } = await import("./measure_build/measure_build.js")
  const { measureTestPlan } = await import(
    "./measure_test_plan/measure_test_plan.js"
  )

  const importMetrics = await measureImport()
  const npmTarballMetrics = await measureNpmTarball()

  const exploringMetrics = await measureExploring()
  const buildMetrics = await measureBuild()
  const testPlanMetrics = await measureTestPlan()

  return {
    groups: {
      "@jsenv/core package": {
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

const executeAndLog = process.argv.includes("--local")
if (executeAndLog) {
  await import("./measure_import/measure_import.js")
  await import("./measure_npm_tarball/measure_npm_tarball.js")
  await import("./measure_exploring/measure_exploring.js")
  await import("./measure_build/measure_build.js")
  await import("./measure_test_plan/measure_test_plan.js")
}
