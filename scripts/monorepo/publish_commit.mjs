/*
 * The "[publish]" commit: prepare_publish.mjs prepares it and, once pushed on main,
 * .github/workflows/publish.yml publishes on npm the versions its message names.
 */

import { execFileSync } from "node:child_process";

export const createPublishCommitMessage = (packageSlugs) => {
  if (packageSlugs.length === 1) {
    return `[publish] ${packageSlugs[0]}`;
  }
  return `[publish] ${packageSlugs.length} packages

${packageSlugs.map((packageSlug) => `- ${packageSlug}`).join("\n")}`;
};

/*
 * The last version each package got in a "[publish]" commit. npm can hold a
 * version it accepted for hours before exposing it: the registry does not show
 * it yet, but it is taken all the same, publishing it again is refused.
 */
export const readVersionsNamedByPublishCommits = (directoryUrl) => {
  const messages = String(
    execFileSync("git", ["log", "--grep=^\\[publish\\]", "--format=%B"], {
      cwd: directoryUrl,
    }),
  );
  const versions = {};
  // newest commit first: the first version met for a package is its last one
  for (const [, packageName, packageVersion] of messages.matchAll(
    /^(?:\[publish\] |- )((?:@[^/\s]+\/)?[^@\s]+)@(\S+)$/gm,
  )) {
    versions[packageName] ??= packageVersion;
  }
  return versions;
};
