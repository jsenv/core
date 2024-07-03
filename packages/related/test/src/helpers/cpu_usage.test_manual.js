import {
  startMeasuringCpuUsage,
  startMeasuringTotalCpuUsage,
  formatUsage,
} from "./cpu_usage.js";

const cpuUsage = startMeasuringCpuUsage();
setInterval(() => {
  console.log(cpuUsage.info.used);
}, 400);

const totalCpuUsage = startMeasuringTotalCpuUsage();
setInterval(() => {
  console.log(`overall: ${formatUsage(totalCpuUsage.overall)}
this process: ${formatUsage(totalCpuUsage.thisProcess)}
`);
}, 400);
