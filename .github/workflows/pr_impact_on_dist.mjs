/*
 * This file is executed by pr_impact.yml GitHub workflow.
 * - it generates file size report before and after merging a pull request
 * - Then, it creates or updates a comment in the pull request
 * See https://github.com/jsenv/file-size-impact
 */

import {
  readGitHubWorkflowEnv,
  reportFileSizeImpactInGitHubPullRequest,
} from "@jsenv/file-size-impact";

await reportFileSizeImpactInGitHubPullRequest({
  ...readGitHubWorkflowEnv(),
  logLevel: "debug",
  buildCommand: "npm run build",
  fileSizeReportUrl: new URL(
    "../../scripts/build/build_file_size.mjs#fileSizeReport",
    import.meta.url,
  ),
});
