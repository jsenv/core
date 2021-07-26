import { reportPerformanceImpact, readGitHubWorkflowEnv } from "@jsenv/performance-impact"

reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  generatePerformanceReportFileRelativeUrl:
    "./.github/workflows/performance_impact/generate_performance_report.js",
})
