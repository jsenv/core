// https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
export const readGitHubWorkflowEnv = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!eventName) {
    throw new Error(
      `missing process.env.GITHUB_EVENT_NAME, we are not in a github workflow`,
    );
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
  return {
    rootDirectoryUrl: process.env.GITHUB_WORKSPACE,
    githubToken,
    repositoryOwner,
    repositoryName,
    commitSha: process.env.GITHUB_SHA,
  };
};
