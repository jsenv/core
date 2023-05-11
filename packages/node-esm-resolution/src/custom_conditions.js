// https://nodejs.org/api/packages.html#resolving-user-conditions
export const readCustomConditionsFromProcessArgs = () => {
  const packageConditions = [];
  process.execArgv.forEach((arg) => {
    if (arg.includes("-C=")) {
      const packageCondition = arg.slice(0, "-C=".length);
      packageConditions.push(packageCondition);
    }
    if (arg.includes("--conditions=")) {
      const packageCondition = arg.slice("--conditions=".length);
      packageConditions.push(packageCondition);
    }
  });
  return packageConditions;
};
