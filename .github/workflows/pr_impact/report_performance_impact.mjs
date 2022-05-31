import {
  reportPerformanceImpact,
  readGitHubWorkflowEnv,
} from "@jsenv/performance-impact"

await reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  performanceReportPath:
    "./scripts/performance/generate_performance_report.mjs#performanceReport",
})
