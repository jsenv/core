import {
  reportPerformanceImpact,
  readGitHubWorkflowEnv,
} from "@jsenv/performance-impact"

await reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  moduleGeneratingPerformanceReportRelativeUrl:
    "./script/performance/generate_performance_report.js",
})
