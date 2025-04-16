# @jsenv/os-metrics

[![npm package](https://img.shields.io/npm/v/@jsenv/os-metrics.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/os-metrics)

A lightweight library for monitoring CPU and memory usage of both your Node.js process and the operating system.

## Features

- Simple API for monitoring system resources
- Process-specific and OS-wide metrics
- Statistical analysis (min, max, median) for measurement periods
- Zero dependencies

## Installation

```console
npm install @jsenv/os-metrics
```

## CPU Usage Monitoring

Monitor CPU usage for both the current process and the entire operating system:

```js
// Start monitoring
const [processCpuMonitoring, osCpuMonitoring] = startMonitoringCpuUsage();

// Take measurements at regular intervals
const interval = setInterval(() => {
  const processCpuUsage = processCpuMonitoring.measure(); // Returns value between 0-1
  const osCpuUsage = osCpuMonitoring.measure(); // Returns value between 0-1

  console.log(`Process CPU: ${(processCpuUsage * 100).toFixed(2)}%`);
  console.log(`System CPU: ${(osCpuUsage * 100).toFixed(2)}%`);
}, 500);

// When finished monitoring
clearInterval(interval);
processCpuMonitoring.end();
osCpuMonitoring.end();

// Access statistical information
const { info: processInfo } = processCpuMonitoring;
console.log({
  minCpuUsage: processInfo.min,
  maxCpuUsage: processInfo.max,
  medianCpuUsage: processInfo.median,
});
```

## Measuring Usage Monitoring

Track memory consumption for both the current process and the system:

```js
import { startMonitoringMemoryUsage } from "@jsenv/os-metrics";

// Start monitoring
const [processMemoryMonitoring, osMemoryMonitoring] =
  startMonitoringMemoryUsage();

// Take measurements at regular intervals
const interval = setInterval(() => {
  const processMemoryBytes = processMemoryMonitoring.measure(); // Returns bytes used
  const osMemoryBytes = osMemoryMonitoring.measure(); // Returns bytes used

  console.log(
    `Process memory: ${(processMemoryBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`System memory: ${(osMemoryBytes / 1024 / 1024).toFixed(2)} MB`);
}, 500);

// When finished monitoring
clearInterval(interval);
processMemoryMonitoring.end();
osMemoryMonitoring.end();

// Access statistical information
const { info: memoryInfo } = processMemoryMonitoring;
console.log({
  minMemoryUsage: `${(memoryInfo.min / 1024 / 1024).toFixed(2)} MB`,
  maxMemoryUsage: `${(memoryInfo.max / 1024 / 1024).toFixed(2)} MB`,
  medianMemoryUsage: `${(memoryInfo.median / 1024 / 1024).toFixed(2)} MB`,
});
```

Each call to `measure()` returns memory usage (a number representing the number of bytes being used).
`end()` stops the monitoring and fill `.info` of the memory metric.

```js
const { info } = processMemoryMonitoring;

info.min; //  the min cpu usage between startMonitoringCpuUsage() and end()
info.max; // the max cpu usage between startMonitoringCpuUsage() and end()
info.median; // the median usage  between startMonitoringCpuUsage() and end()
```

## API Reference

### `startMonitoringCpuUsage()`

Starts monitoring CPU usage and returns two monitoring objects:

- First: Process CPU monitoring
- Second: OS-wide CPU monitoring

### `startMonitoringMemoryUsage()`

Starts monitoring memory usage and returns two monitoring objects:

- First: Process memory monitoring
- Second: OS-wide memory monitoring

### Monitoring Object Methods

Each monitoring object provides:

- `measure()`: Take a measurement and return the current value
- `end()`: Stop monitoring and calculate statistical information
- `info`: Object containing min, max, and median values (available after calling end())

## Use Cases

- Performance testing and benchmarking
- Resource usage optimization
- System monitoring in Node.js applications
- Detecting memory leaks and CPU spikes

## Platform Support

Works on all major operating systems supported by Node.js (Windows, macOS, Linux).
