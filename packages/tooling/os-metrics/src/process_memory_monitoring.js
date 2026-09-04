import { memoryUsage } from "node:process";
import { startMonitoringMetric } from "./metric_monitoring.js";

export const startMeasuringProcessMemoryUsage = () => {
  const processMemoryUsageMonitoring = startMonitoringMetric(() => {
    // memoryUsage.rss() reads only rss; the full memoryUsage() computes
    // every field and shows up in build profiles
    return memoryUsage.rss();
  });
  return processMemoryUsageMonitoring;
};
