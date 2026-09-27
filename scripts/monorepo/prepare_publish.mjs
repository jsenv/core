/*
 * Sync package versions and commit everything with a "[publish]" commit.
 * Once pushed on main, that commit makes .github/workflows/publish.yml publish
 * on npm the packages whose version is not on npm yet.
 */

import { syncPackagesVersions } from "@jsenv/monorepo";
import { execFileSync } from "node:child_process";
import { packagesRelations } from "./packages_relations.mjs";

const directoryUrl = new URL("../../", import.meta.url);
const { outdatedPackageNames, toPublishPackageNames, workspacePackages } =
  await syncPackagesVersions({
    directoryUrl,
    packagesRelations,
  });
if (outdatedPackageNames.length) {
  // their version was set back to the one on npm: to review before publishing
  process.exit(1);
}
if (toPublishPackageNames.length === 0) {
  process.exit(0);
}

const packageSlugs = toPublishPackageNames.map(
  (packageName) =>
    `${packageName}@${workspacePackages[packageName].packageObject.version}`,
);
const commitMessage =
  packageSlugs.length === 1
    ? `[publish] ${packageSlugs[0]}`
    : `[publish] ${packageSlugs.length} packages

${packageSlugs.map((packageSlug) => `- ${packageSlug}`).join("\n")}`;
execFileSync("git", ["add", "--all"], {
  cwd: directoryUrl,
  stdio: "inherit",
});
// versions may already be committed: the commit is still needed to trigger the publish
execFileSync("git", ["commit", "--allow-empty", "--message", commitMessage], {
  cwd: directoryUrl,
  stdio: "inherit",
});
console.log(`Review with "git show", then "git push" to publish on npm`);
