import {
  readGitHubWorkflowEnv,
  reportPerformanceImpact,
} from "@jsenv/performance-impact";

await reportPerformanceImpact({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  installCommand: "npm install",
  performanceReportUrl: new URL(
    "../../scripts/performance/generate_performance_report.mjs#performanceReport",
    import.meta.url,
  ),
});
