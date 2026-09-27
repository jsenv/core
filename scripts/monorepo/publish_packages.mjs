/*
 * Publish all package if needed (when version found in package file is not already published)
 *
 * Runs in .github/workflows/publish.yml where npm authenticates with trusted publishing.
 * Locally it uses the token from secrets.json, needed only for the first publish
 * of a new package (trusted publishing can only be configured on an existing package).
 */

import { readFile } from "@jsenv/filesystem";
import { publishPackages } from "@jsenv/monorepo";
import { packagesRelations } from "./packages_relations.mjs";

if (!process.env.CI) {
  const secrets = await readFile(
    new URL("../../secrets.json", import.meta.url),
    { as: "json" },
  );
  Object.assign(process.env, secrets);
}
await publishPackages({
  directoryUrl: new URL("../../", import.meta.url),
  packagesRelations,
});
