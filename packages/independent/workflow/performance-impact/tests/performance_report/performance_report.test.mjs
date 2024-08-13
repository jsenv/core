const generatePerfReportFileUrl = new URL(
  "./generate_perf_report.mjs",
  import.meta.url,
);
const { generatePerformanceReport } = await import(generatePerfReportFileUrl);

const performanceReport = await generatePerformanceReport();
console.log(JSON.stringify(performanceReport, null, "  "));
