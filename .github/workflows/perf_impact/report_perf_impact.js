import { reportPerformanceImpact, readGitHubWorkflowEnv } from "@jsenv/perf-impact"

reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  generatePerformanceReportFileRelativeUrl:
    "./.github/workflows/perf_impact/generate_perf_report.js",
})
