import { memoryUsage } from "node:process";
import { startMonitoringMetric } from "./metric_monitoring.js";

export const startMeasuringProcessMemoryUsage = () => {
  const processMemoryUsageMonitoring = startMonitoringMetric(() => {
    return memoryUsage().rss;
  });
  return processMemoryUsageMonitoring;
};
