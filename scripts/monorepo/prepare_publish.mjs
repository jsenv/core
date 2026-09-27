/*
 * Sync package versions, stage everything and prepare a "[publish]" commit message.
 * Once committed and pushed on main, that commit makes .github/workflows/publish.yml
 * publish on npm the packages whose version is not on npm yet.
 */

import { syncPackagesVersions } from "@jsenv/monorepo";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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
const git = (...args) =>
  String(execFileSync("git", args, { cwd: directoryUrl })).trim();
git("add", "--all");
// the commit is left to be reviewed and made by hand: git and VSCode both take
// SQUASH_MSG as the message of the next commit, and git removes it once committed
writeFileSync(
  new URL(git("rev-parse", "--git-path", "SQUASH_MSG"), directoryUrl),
  `${commitMessage}\n`,
);
let somethingStaged = false;
try {
  git("diff", "--cached", "--quiet");
} catch {
  somethingStaged = true;
}
if (somethingStaged) {
  console.log(`Changes are staged with the "[publish]" message prepared.
Review and commit them (VSCode source control, or "git commit --no-edit"), then "git push" to publish on npm
and "npm run monorepo:wait_publish" to know when it is done`);
} else {
  // versions are already committed: an empty commit is still needed to trigger the publish
  console.log(`Nothing to stage, versions are already committed.
Run "git commit --allow-empty --no-edit" to create the "[publish]" commit, then "git push" to publish on npm
and "npm run monorepo:wait_publish" to know when it is done`);
}
