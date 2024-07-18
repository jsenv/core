import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import prompts from "prompts";

import { UNICODE } from "@jsenv/humanize";

export const installPackagesIfMissing = async (packageNames, directoryUrl) => {
  const isAvailable = createPackageDetector(directoryUrl);
  const missingPackageNameArray = [];
  await Promise.all(
    packageNames.map(async (packageName) => {
      const isAvailableResult = await isAvailable(packageName);
      if (!isAvailableResult) {
        missingPackageNameArray.push(packageName);
      }
    }),
  );
  const missingCount = missingPackageNameArray.length;
  if (missingCount === 0) {
    return;
  }
  if (missingCount === 1) {
    const missingPackageName = missingPackageNameArray[0];
    console.log(
      `${UNICODE.INFO} "${missingPackageName}" package needs to be installed`,
    );
    // https://github.com/terkelg/prompts?tab=readme-ov-file#-prompt-objects
    const { value } = await prompts({
      type: "confirm",
      name: "value",
      message: `Do you want to install "${missingPackageName}"`,
      initial: true,
    });
    if (!value) {
      console.log(`${UNICODE.INFO} aborted due to missing package`);
      process.exit(0);
    }
    await installPackage(missingPackageName, directoryUrl);
    return;
  }

  console.log(`${UNICODE.INFO} ${missingCount} packages needs to be installed:
  - ${missingPackageNameArray.join("\n  - ")}`);
  const { value } = await prompts({
    type: "confirm",
    name: "value",
    message: "Do you want to install them?",
    initial: true,
  });
  if (!value) {
    console.log(`${UNICODE.INFO} aborted due to missing package`);
    process.exit(0);
  }
  for (const missingPackageName of missingPackageNameArray) {
    await installPackage(missingPackageName, directoryUrl);
  }
};

const createPackageDetector = (directoryUrl) => {
  const localPackageNameSet = new Set();
  const globalPackageNameSet = new Set();
  const npmListCommandOutput = getCommandOutputSyncCatchingFailure(
    `npm list --depth=0 --json`,
    {
      cwd: fileURLToPath(directoryUrl),
    },
  );
  const npmListResult = JSON.parse(npmListCommandOutput);
  for (const dependencyName of Object.keys(npmListResult.dependencies)) {
    localPackageNameSet.add(dependencyName);
  }
  const npmListGlobalCommandOutput = getCommandOutputSyncCatchingFailure(
    `npm list --global --depth=0 --json`,
    {
      cwd: fileURLToPath(directoryUrl),
    },
  );
  const npmListGlobalResult = JSON.parse(npmListGlobalCommandOutput);
  for (const dependencyName of Object.keys(npmListGlobalResult.dependencies)) {
    globalPackageNameSet.add(dependencyName);
  }
  return (packageName) => {
    return (
      localPackageNameSet.has(packageName) ||
      globalPackageNameSet.has(packageName)
    );
  };
};

const getCommandOutputSyncCatchingFailure = (command, options) => {
  try {
    const output = execSync(`npm list --depth=0 --json`, {
      stdio: "pipe",
      ...options,
    });
    return String(output);
  } catch (e) {
    return String(e.stdout);
  }
};

// const isPackageAvailable = async (packageName) => {
//   try {
//     await import.meta.resolve(packageName);
//     return true;
//   } catch (e) {
//     if (e && e.code === "ERR_MODULE_NOT_FOUND") {
//       return false;
//     }
//     return true;
//   }
// };

const installPackage = async (packageName, directoryUrl) => {
  const installCommand = `npm install ${packageName}`;
  console.log(installCommand);
  execSync(`npm install ${packageName}`, {
    stdio: [0, 1, 2],
    cwd: fileURLToPath(directoryUrl),
  });
};
