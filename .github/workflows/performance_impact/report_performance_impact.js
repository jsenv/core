import { reportPerformanceImpact, readGitHubWorkflowEnv } from "@jsenv/performance-impact"

reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  generatePerformanceReportFileRelativeUrl: "./script/performance/generate_performance_report.js",
})
