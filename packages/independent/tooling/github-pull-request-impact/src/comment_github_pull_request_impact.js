/**
 * This function is generic and is meant to be reused by
 * @jsenv/file-size-impact, @jsenv/performance-impact and @jsenv/lighthouse-score-impact
 */

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { createLogger, errorToMarkdown } from "@jsenv/humanize";
import { fileURLToPath } from "node:url";
import { createGitHubPullRequestCommentText } from "./internal/create_github_pull_request_comment_text.js";
import { exec } from "./internal/exec.js";
import * as githubRESTAPI from "./internal/github_rest_api.js";
import { renderGeneratedByText } from "./internal/render_generated_by_text.js";

export const commentGitHubPullRequestImpact = async ({
  logLevel,
  commandLogs = false,
  infoLogs = true,
  rootDirectoryUrl,

  githubToken,
  repositoryOwner,
  repositoryName,
  pullRequestNumber,

  collectInfo,
  commentIdentifier,
  createCommentForBeforeMergeError = jsenvCreateBeforeMergeErrorComment,
  createCommentForAfterMergeError = jsenvCreateCommentForAfterMergeError,
  createCommentForVersionMismatch = jsenvCreateCommentForVersionMismatch,
  createCommentForComparison = jsenvCreateCommentForComparison,
  generatedByLink = {
    url: "https://github.com/jsenv/core/tree/main/packages/tooling/github-pull-request-impact",
    text: "@jsenv/github-pull-request-impact",
  },
  runLink,
  commitInGeneratedByInfo = true,

  catchError = false,
}) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);
  if (typeof collectInfo !== "function") {
    throw new TypeError(
      `collectInfo must be a function but received ${collectInfo}`,
    );
  }
  if (typeof commentIdentifier !== "string") {
    throw new TypeError(
      `commentIdentifier must be a string but received ${commentIdentifier}`,
    );
  }
  if (typeof githubToken !== "string") {
    throw new TypeError(
      `githubToken must be a string but received ${githubToken}`,
    );
  }
  if (typeof repositoryOwner !== "string") {
    throw new TypeError(
      `repositoryOwner must be a string but received ${repositoryOwner}`,
    );
  }
  if (typeof repositoryName !== "string") {
    throw new TypeError(
      `repositoryName must be a string but received ${repositoryName}`,
    );
  }
  pullRequestNumber = String(pullRequestNumber);
  if (typeof pullRequestNumber !== "string") {
    throw new TypeError(
      `pullRequestNumber must be a string but received ${pullRequestNumber}`,
    );
  }

  const logger = createLogger({ logLevel });

  let cleanup = () => {};

  try {
    return await commentPrImpact({
      logger,
      commandLogs,
      infoLogs,
      rootDirectoryUrl,

      githubToken,
      repositoryOwner,
      repositoryName,
      pullRequestNumber,

      collectInfo,
      commentIdentifier,
      createCommentForBeforeMergeError,
      createCommentForAfterMergeError,
      createCommentForVersionMismatch,
      createCommentForComparison,
      generatedByLink,
      runLink,
      commitInGeneratedByInfo,

      catchError,
    });
  } finally {
    cleanup();
  }
};

const commentPrImpact = async ({
  logger,
  infoLogs,
  commandLogs,
  rootDirectoryUrl,

  githubToken,
  repositoryOwner,
  repositoryName,
  pullRequestNumber,

  collectInfo,
  commentIdentifier,
  createCommentForBeforeMergeError,
  createCommentForAfterMergeError,
  createCommentForVersionMismatch,
  createCommentForComparison,
  generatedByLink,
  runLink,
  commitInGeneratedByInfo,

  catchError,
}) => {
  const execCommandInRootDirectory = (command) => {
    logger.info(`> ${command}`);
    return exec(command, {
      cwd: fileURLToPath(rootDirectoryUrl),
      onLog: (string) => {
        if (commandLogs) {
          logger.info(string);
        }
      },
      onErrorLog: (string) => logger.error(string),
    });
  };

  const pullApiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/pulls/${pullRequestNumber}`;
  // https://developer.github.com/v3/pulls/#get-a-pull-request
  logger.debug(`get pull request ${pullApiUrl}`);
  const pullRequest = await githubRESTAPI.GET({
    url: pullApiUrl,
    githubToken,
  });
  const pullRequestHtmlUrl = pullRequest.html_url;
  const pullRequestBase = pullRequest.base.ref;
  const pullRequestHead = pullRequest.head.ref;

  /*
  Adds a commit-sha hidden at the top of the comment body:
  This way, even if the comment generated is exactly the same, GitHub
  will consider the comment as edited.
  Without this, someone could think the build did not run because the comment
  was not updated (It happened to me several times).
  */
  const commentHeader = `${commentIdentifier}
<!-- head-commit-sha=${pullRequest.head.sha} -->`;
  const commentWarnings = [];
  const commentFooter = renderGeneratedByText({
    generatedByLink,
    runLink,
    commitLink: commitInGeneratedByInfo
      ? {
          url: `https://github.com/${repositoryOwner}/${repositoryName}/pull/${pullRequestNumber}/commits/${pullRequest.head.sha}`,
          text: shortenCommiSha(pullRequest.head.sha),
        }
      : null,
  });

  logger.debug(`searching comment in pull request ${pullRequestHtmlUrl}`);
  const pullRequestCommentApiUrl = pullRequest.comments_url;
  const comments = await githubRESTAPI.GET({
    url: pullRequestCommentApiUrl,
    githubToken,
  });
  const existingComment = comments.find(({ body }) =>
    body.includes(commentIdentifier),
  );
  if (existingComment) {
    logger.debug(`comment found at ${existingComment.html_url}.`);
  } else {
    logger.debug(`no existing comment found`);
  }

  const patchOrPostComment = async (commentInfo) => {
    let commentParts;
    if (typeof commentInfo === "string") {
      commentParts = {
        header: commentHeader,
        warnings: commentWarnings,
        body: commentInfo,
        footer: commentFooter,
      };
    } else {
      commentParts = {
        header: commentHeader,
        warnings: [...commentWarnings, ...(commentInfo.warnings || [])],
        body: commentInfo.body,
        footer: commentFooter,
      };
    }

    const commentBody = createGitHubPullRequestCommentText(commentParts);

    if (existingComment) {
      if (existingComment.body === commentBody) {
        logger.info(`existing comment body is the same -> skip comment PATCH`);
        return existingComment;
      }
      logger.info(`updating comment at ${existingComment.html_url}`);
      const comment = await githubRESTAPI.PATCH({
        url: `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/issues/comments/${existingComment.id}`,
        githubToken,
        body: { body: commentBody },
      });
      logger.info("comment updated");
      return comment;
    }

    logger.info(`creating comment`);
    const comment = await githubRESTAPI.POST({
      url: `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/issues/${pullRequestNumber}/comments`,
      githubToken,
      body: { body: commentBody },
    });
    logger.info(`comment created at ${comment.html_url}`);
    return comment;
  };

  const isFork =
    pullRequest.base.repo.full_name !== pullRequest.head.repo.full_name;
  const isInPullRequestWorkflow =
    process.env.GITHUB_EVENT_NAME === "pull_request";
  if (isFork && isInPullRequestWorkflow) {
    logger.warn(formatGithubTokenNotAllowedToCommentWarning());
  }

  let headRef;
  if (isFork) {
    // https://github.community/t/checkout-a-branch-from-a-fork/276/2
    headRef = `refs/pull/${pullRequestNumber}/merge`;
  } else {
    headRef = pullRequestHead;
  }

  let beforeMergeInfo;
  try {
    // cannot use depth=1 arg otherwise git merge might have merge conflicts
    await execCommandInRootDirectory(
      `git fetch --no-tags --prune origin ${pullRequestBase}`,
    );
    await execCommandInRootDirectory(
      `git reset --hard origin/${pullRequestBase}`,
    );
    beforeMergeInfo = await collectInfo({
      beforeMerge: true,
      execCommandInRootDirectory,
    });
    if (infoLogs) {
      logger.debug(debugBeforeMergeInfo(beforeMergeInfo));
    }
  } catch (error) {
    logger.error(error.stack);
    const comment = await patchOrPostComment(
      createCommentForBeforeMergeError(error, {
        pullRequestHead,
        pullRequestBase,
      }),
    );
    if (catchError) {
      return { error, comment };
    }
    throw error;
  }

  let afterMergeInfo;
  try {
    // buildCommand might generate files that could conflict when doing the merge
    // reset to avoid potential merge conflicts
    await execCommandInRootDirectory(
      `git reset --hard origin/${pullRequestBase}`,
    );
    // Avoid "The following untracked working tree files would be overwritten by merge" error
    await execCommandInRootDirectory(`git clean -d -f .`);
    // cannot use depth=1 arg otherwise git merge might have merge conflicts
    await execCommandInRootDirectory(
      `git fetch --no-tags --prune origin ${headRef}`,
    );
    // ensure there is user.email + user.name required to perform git merge command
    // without them git would complain that it does not know who we are

    const restoreGitUserEmail = await ensureGitConfig("user.email", {
      valueIfMissing: "you@example.com",
      execCommandInRootDirectory,
    });
    const restoreGitUserName = await ensureGitConfig("user.name", {
      valueIfMissing: "Your Name",
      execCommandInRootDirectory,
    });
    // could we use https://stackoverflow.com/a/6283843 ?
    try {
      await execCommandInRootDirectory(
        `git merge FETCH_HEAD --allow-unrelated-histories --no-ff --no-commit`,
      );
    } catch {
      throw new Error(`git merge command failed (is there a merge conflict?)`);
    }
    await restoreGitUserEmail();
    await restoreGitUserName();
    afterMergeInfo = await collectInfo({
      afterMerge: true,
      execCommandInRootDirectory,
    });
    if (infoLogs) {
      logger.debug(debugAfterMergeInfo(afterMergeInfo));
    }
  } catch (error) {
    logger.error(error.stack);
    const gitHubComment = await patchOrPostComment(
      createCommentForAfterMergeError(error, {
        pullRequestHead,
        pullRequestBase,
      }),
    );
    if (catchError) {
      return { error, gitHubComment };
    }
    throw error;
  }

  const beforeMergeVersion = beforeMergeInfo.version;
  const afterMergeVersion = afterMergeInfo.version;
  if (beforeMergeVersion !== afterMergeInfo.version) {
    const gitHubComment = await patchOrPostComment(
      createCommentForVersionMismatch({
        beforeMergeVersion,
        afterMergeVersion,
      }),
    );
    return { gitHubComment };
  }

  const commentForComparison = await createCommentForComparison({
    logger,

    pullRequestBase,
    pullRequestHead,
    beforeMergeData: beforeMergeInfo.data,
    afterMergeData: afterMergeInfo.data,
    existingComment,
  });
  const gitHubComment = await patchOrPostComment(commentForComparison);

  return { gitHubComment };
};

const ensureGitConfig = async (
  name,
  { execCommandInRootDirectory, valueIfMissing },
) => {
  try {
    await execCommandInRootDirectory(`git config ${name}`);
    return () => {};
  } catch {
    await execCommandInRootDirectory(`git config ${name} "${valueIfMissing}"`);
    return async () => {
      await execCommandInRootDirectory(`git config --unset ${name}`);
    };
  }
};

// https://docs.github.com/en/github/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls#commit-shas
const shortenCommiSha = (sha) => {
  if (sha.includes("@")) return sha;
  return sha.slice(0, 7);
};

const debugBeforeMergeInfo = (beforeMergeInfo) => {
  return `
--- before merge info ---
${JSON.stringify(beforeMergeInfo, null, "  ")}

`;
};

const debugAfterMergeInfo = (afterMergeInfo) => {
  return `
--- after merge info ---
${JSON.stringify(afterMergeInfo, null, "  ")}

`;
};

const formatGithubTokenNotAllowedToCommentWarning = () => {
  return `The github token will certainly not be allowed to post comment in the pull request.
This is because pull request comes from a fork and your workflow is runned on "pull_request".
To fix this, change "pull_request" for "pull_request_target" in your workflow file.
See https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request_target`;
};

const jsenvCreateBeforeMergeErrorComment = (
  error,
  { pullRequestBase, pullRequestHead },
) => {
  return `---

**Error:** Error while trying to collect info before merging ${pullRequestHead} into ${pullRequestBase}.

${errorToMarkdown(error)}

---`;
};

const jsenvCreateCommentForAfterMergeError = (
  error,
  { pullRequestBase, pullRequestHead },
) => {
  return `---

**Error:** Error while trying to collect info after merging ${pullRequestHead} into ${pullRequestBase}.

${errorToMarkdown(error)}

---`;
};

const jsenvCreateCommentForVersionMismatch = ({
  beforeMergeVersion,
  afterMergeversion,
}) => {
  return `---

**Error:** Cannot compare before and after merge data because the version are different.

Before merge data version: ${beforeMergeVersion}
<br />
After merge data version: ${afterMergeversion}

---`;
};

const jsenvCreateCommentForComparison = ({
  beforeMergeInfo,
  afterMergeInfo,
}) => {
  return `--- before merge ---
${JSON.stringify(beforeMergeInfo, null, "  ")}
--- after merge ---
${JSON.stringify(afterMergeInfo, null, "  ")}`;
};
