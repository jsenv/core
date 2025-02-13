import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const readProjectPackage = ({ rootDirectoryUrl }) => {
  const packageFileUrlObject = new URL("./package.json", rootDirectoryUrl);
  let packageInProject;
  try {
    const packageString = String(readFileSync(packageFileUrlObject));
    try {
      packageInProject = JSON.parse(packageString);
    } catch (e) {
      if (e.name === "SyntaxError") {
        throw new Error(`syntax error while parsing project package.json
--- syntax error stack ---
${e.stack}
--- package.json path ---
${fileURLToPath(packageFileUrlObject)}`);
      }
      throw e;
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new Error(
        `cannot find project package.json
--- package.json path ---
${fileURLToPath(packageFileUrlObject)}`,
      );
    }
    throw e;
  }
  return packageInProject;
};
