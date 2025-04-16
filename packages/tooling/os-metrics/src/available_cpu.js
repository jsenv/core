import { availableParallelism, cpus } from "node:os";

export const countAvailableCpus = () => {
  if (typeof availableParallelism === "function") {
    return availableParallelism();
  }
  const cpuArray = cpus();
  return cpuArray.length || 1;
};
