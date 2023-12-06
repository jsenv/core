// https://gist.github.com/GaetanoPiazzolla/c40e1ebb9f709d091208e89baf9f4e00

import { cpus } from "node:os";

export const startMeasuringCpuUsage = () => {
  let previousCpuArray = cpus();
  let previousMs = Date.now();

  const overall = {
    inactive: 100,
    active: 0,
    system: 0,
    user: 0,
  };
  const details = previousCpuArray.map(() => {
    return {
      inactive: 100,
      active: 0,
      system: 0,
      user: 0,
    };
  });

  const samples = [];
  const interval = setInterval(() => {
    let cpuArray = cpus();
    const ms = Date.now();
    const ellapsedMs = ms - previousMs;
    const cpuUsagesSample = [];
    let overallSystemMs = 0;
    let overallUserMs = 0;
    let overallInactiveMs = 0;
    let overallActiveMs = 0;
    let overallMsEllapsed = 0;
    let index = 0;
    for (const cpu of cpuArray) {
      const previousCpuTimes = previousCpuArray[index].times;
      const cpuTimes = cpu.times;
      const systemMs = cpuTimes.sys - previousCpuTimes.sys;
      const userMs = cpuTimes.user - previousCpuTimes.user;
      const activeMs = systemMs + userMs;
      const inactiveMs = ellapsedMs - activeMs;
      const cpuUsageSample = {
        inactive: inactiveMs / ellapsedMs,
        active: activeMs / ellapsedMs,
        system: systemMs / ellapsedMs,
        user: userMs / ellapsedMs,
      };
      cpuUsagesSample.push(cpuUsageSample);

      overallSystemMs += systemMs;
      overallUserMs += userMs;
      overallInactiveMs += inactiveMs;
      overallActiveMs += activeMs;
      overallMsEllapsed += ellapsedMs;
      index++;
    }
    const overallUsageSample = {
      inactive: overallInactiveMs / overallMsEllapsed,
      active: overallActiveMs / overallMsEllapsed,
      system: overallSystemMs / overallMsEllapsed,
      user: overallUserMs / overallMsEllapsed,
    };
    previousCpuArray = cpuArray;
    previousMs = ms;
    samples.push({
      cpuUsagesSample,
      overallUsageSample,
    });

    if (samples.length === 10) {
      let index = 0;
      for (const detail of details) {
        let systemSum = 0;
        let userSum = 0;
        let inactiveSum = 0;
        let activeSum = 0;
        for (const sample of samples) {
          const { cpuUsagesSample } = sample;
          const cpuUsageSample = cpuUsagesSample[index];
          inactiveSum += cpuUsageSample.inactive;
          activeSum += cpuUsageSample.active;
          systemSum += cpuUsageSample.system;
          userSum += cpuUsageSample.user;
        }
        Object.assign(detail, {
          inactive: inactiveSum / samples.length,
          active: activeSum / samples.length,
          system: systemSum / samples.length,
          user: userSum / samples.length,
        });
        index++;
      }

      let overallSystemSum = 0;
      let overallUserSum = 0;
      let overallInactiveSum = 0;
      let overallActiveSum = 0;
      for (const sample of samples) {
        const { overallUsageSample } = sample;
        overallSystemSum += overallUsageSample.system;
        overallUserSum += overallUsageSample.user;
        overallInactiveSum += overallUsageSample.inactive;
        overallActiveSum += overallUsageSample.active;
      }
      Object.assign(overall, {
        inactive: overallInactiveSum / samples.length,
        active: overallActiveSum / samples.length,
        system: overallSystemSum / samples.length,
        user: overallUserSum / samples.length,
      });
      // console.log(formatUsage(globalUsageInfo));
      samples.length = 0;
    }
  }, 25);
  interval.unref();

  return {
    overall,
    details,
    stop: () => {
      clearInterval(interval);
    },
  };
};

export const formatUsage = (usageInfo) => {
  const { active, inactive, system, user } = usageInfo;

  return `${ratioAsPercentage(active)} (system: ${ratioAsPercentage(
    system,
  )}, user: ${ratioAsPercentage(user)}), inactive: ${ratioAsPercentage(
    inactive,
  )}`;
};

export const ratioAsPercentage = (ratio) => {
  const percentageAsNumber = ratio * 100;
  const percentageAsNumberRounded = Math.round(percentageAsNumber);
  const percentage = `${percentageAsNumberRounded}%`;
  return percentage;
};
