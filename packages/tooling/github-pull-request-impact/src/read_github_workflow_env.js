import { readFileSync } from "node:fs";

export const readGitHubWorkflowEnv = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!eventName) {
    throw new Error(
      `missing process.env.GITHUB_EVENT_NAME, we are not in a github workflow`,
    );
  }
  if (eventName !== "pull_request" && eventName !== "pull_request_target") {
    throw new Error(`must be called only in a pull request`);
  }
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error(`missing githubToken`);
  }
  const githubRepository = process.env.GITHUB_REPOSITORY;
  if (!githubRepository) {
    throw new Error(`missing process.env.GITHUB_REPOSITORY`);
  }
  const [repositoryOwner, repositoryName] = githubRepository.split("/");
  const pullRequestNumber = readPullRequestNumber();
  const runId = process.env.GITHUB_RUN_ID;
  const runLink = runId
    ? {
        url: `https://github.com/${repositoryOwner}/${repositoryName}/actions/runs/${runId}`,
        text: `${process.env.GITHUB_WORKFLOW || "workflow"}#${runId}`,
      }
    : undefined;
  return {
    rootDirectoryUrl: process.env.GITHUB_WORKSPACE,
    githubToken,
    repositoryOwner,
    repositoryName,
    pullRequestNumber,
    runLink,
  };
};

const readPullRequestNumber = () => {
  const githubRef = process.env.GITHUB_REF;
  if (!githubRef) {
    throw new Error(`missing process.env.GITHUB_REF`);
  }
  const pullRequestNumber = githubRefToPullRequestNumber(githubRef);
  if (pullRequestNumber) return pullRequestNumber;
  // https://github.com/actions/checkout/issues/58#issuecomment-589447479
  const githubEventFilePath = process.env.GITHUB_EVENT_PATH;
  if (githubEventFilePath) {
    console.warn(`pull request number not found in process.env.GITHUB_REF, trying inside github event file.
--- process.env.GITHUB_REF ---
${githubRef}
--- github event file path ---
${githubEventFilePath}
`);
    const githubEventFileContent = String(readFileSync(githubEventFilePath));
    const githubEvent = JSON.parse(githubEventFileContent);
    const pullRequestNumber = githubEvent.pull_request.number;
    console.warn(`pull request number found in the file: ${pullRequestNumber}`);
    if (pullRequestNumber) {
      return pullRequestNumber;
    }
  }
  throw new Error(`cannot get pull request number from process.env.GITHUB_REF
--- process.env.GITHUB_REF ---
${githubRef}`);
};

const githubRefToPullRequestNumber = (githubRef) => {
  const pullPrefix = "refs/pull/";
  const pullRequestNumberStartIndex = githubRef.indexOf(pullPrefix);
  if (pullRequestNumberStartIndex === -1) return undefined;
  const afterPull = githubRef.slice(
    pullRequestNumberStartIndex + pullPrefix.length,
  );
  const slashAfterPullIndex = afterPull.indexOf("/");
  if (slashAfterPullIndex === -1) return undefined;
  const pullRequestNumberString = afterPull.slice(0, slashAfterPullIndex);
  return Number(pullRequestNumberString);
};
