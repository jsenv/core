import { reportPerformanceImpact, readGitHubWorkflowEnv } from "@jsenv/perf-impact"

reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  generatePerformanceReportFileRelativeUrl:
    "./.github/workflows/perf_impact/generate_perf_report.js",
  isPerformanceImpactSignificant: ({ metricDurationBeforeMerge, metricDurationDelta }) => {
    const absoluteDelta = Math.abs(metricDurationDelta)

    // the absolute diff is below 10ms -> not important
    if (absoluteDelta < 10) {
      return false
    }

    // the absolute diff as percentage is below 10% -> not important
    const absoluteDeltaAsRatio = absoluteDelta / metricDurationBeforeMerge
    const absoluteDeltaAsPercentage = absoluteDeltaAsRatio * 100
    if (absoluteDeltaAsPercentage <= 10) {
      return false
    }

    return true
  },
})
