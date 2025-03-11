import { readFileSync } from "node:fs";

export const defaultReadPackageJson = (packageUrl) => {
  const packageJsonUrl = new URL("package.json", packageUrl);
  const buffer = readFileSync(packageJsonUrl);
  const string = String(buffer);
  try {
    return JSON.parse(string);
  } catch {
    throw new Error(`Invalid package configuration`);
  }
};
