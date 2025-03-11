/*
 * Publish all package if needed (when version found in package file is not already published)
 */

import { readFile } from "@jsenv/filesystem";
import { publishPackages } from "@jsenv/monorepo";

if (!process.env.CI) {
  const secrets = await readFile(
    new URL("../../secrets.json", import.meta.url),
    { as: "json" },
  );
  Object.assign(process.env, secrets);
}
await publishPackages({
  directoryUrl: new URL("../../", import.meta.url),
});
