import { readFileSync } from "node:fs";

export const defaultReadPackageJson = (packageUrl) => {
  const packageJsonFileUrl = new URL("./package.json", packageUrl);
  let packageJsonFileContentBuffer;
  try {
    packageJsonFileContentBuffer = readFileSync(packageJsonFileUrl, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
  const packageJsonFileContentString = String(packageJsonFileContentBuffer);
  try {
    const packageJsonFileContentObject = JSON.parse(
      packageJsonFileContentString,
    );
    return packageJsonFileContentObject;
  } catch {
    throw new Error(`Invalid package configuration at ${packageJsonFileUrl}`);
  }
};
