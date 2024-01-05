import { startMeasuringCpuUsage, formatUsage } from "./cpu_usage.js";

const cpuUsage = startMeasuringCpuUsage();

setInterval(() => {
  console.log(formatUsage(cpuUsage.overall));
}, 400);
