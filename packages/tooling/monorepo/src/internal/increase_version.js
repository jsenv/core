import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// https://github.com/npm/node-semver#readme
const { parse, inc } = require("semver");

export const increaseVersion = (version, fileUrl) => {
  const result = parse(version);
  if (!result) {
    throw new Error(
      `unable to increase version ${version}${fileUrl ? ` for ${fileUrl}` : ``}`,
    );
  }
  const { prerelease } = result;
  if (prerelease.length === 0) {
    return inc(version, "patch");
  }
  return inc(version, "prerelease", prerelease[0]);
};
