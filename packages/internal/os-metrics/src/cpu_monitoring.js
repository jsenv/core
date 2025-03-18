// https://gist.github.com/GaetanoPiazzolla/c40e1ebb9f709d091208e89baf9f4e00

import { startMeasuringTotalCpuUsage } from "./cpu_usage.js";
import { startMonitoringMetric } from "./metric_monitoring.js";

export const startMonitoringCpuUsage = () => {
  const cpuUsage = startMeasuringTotalCpuUsage();
  const processCpuUsageMonitoring = startMonitoringMetric(() => {
    return cpuUsage.thisProcess.active;
  });
  const osCpuUsageMonitoring = startMonitoringMetric(() => {
    return cpuUsage.overall.active;
  });
  const result = [processCpuUsageMonitoring, osCpuUsageMonitoring];
  result.stop = cpuUsage.stop;
  return cpuUsage;
};
