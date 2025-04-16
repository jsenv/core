import { freemem, totalmem } from "node:os";
import { memoryUsage } from "node:process";
import { startMonitoringMetric } from "./metric_monitoring.js";

export const startMonitoringMemoryUsage = () => {
  const processMemoryUsageMonitoring = startMonitoringMetric(() => {
    return memoryUsage().rss;
  });
  const osMemoryUsageMonitoring = startMonitoringMetric(() => {
    const total = totalmem();
    const free = freemem();
    return total - free;
  });
  const stop = () => {
    processMemoryUsageMonitoring.stop();
    osMemoryUsageMonitoring.stop();
  };
  const result = [processMemoryUsageMonitoring, osMemoryUsageMonitoring];
  result.stop = stop;
  return result;
};
