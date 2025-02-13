import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import * as githubRESTAPI from "@jsenv/github-pull-request-impact/src/internal/github_rest_api.js";
import { createLogger } from "@jsenv/humanize";
import { readProjectPackage } from "./internal/read_project_package.js";

export const ensureGithubReleaseForPackage = async ({
  logLevel,
  rootDirectoryUrl,
}) => {
  const logger = createLogger({ logLevel });
  logger.debug(
    `autoReleaseOnGithub(${JSON.stringify(
      { rootDirectoryUrl, logLevel },
      null,
      "  ",
    )})`,
  );

  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl);

  const {
    githubToken,
    githubRepositoryOwner,
    githubRepositoryName,
    githubSha,
  } = getOptionsFromGithubAction();

  logger.debug(`reading project package.json`);
  const projectPackage = readProjectPackage({ rootDirectoryUrl });
  const packageVersion = projectPackage.version;
  logger.debug(`${packageVersion} found in package.json`);
  if (
    packageVersion.includes("alpha") ||
    packageVersion.includes("beta") ||
    packageVersion.includes("prerelease")
  ) {
    logger.info(
      `skip because package version ("${packageVersion}") is a prerelease`,
    );
    return;
  }

  logger.debug(`search release for ${packageVersion} on github`);
  const githubReleaseName = `v${packageVersion}`;
  // https://developer.github.com/v3/git/refs/#get-a-single-reference
  const existingRelease = await githubRESTAPI.GET({
    url: `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/git/ref/tags/${githubReleaseName}`,
    githubToken,
  });
  if (existingRelease) {
    logger.info(
      `${packageVersion} already released at ${generateReleaseUrl({
        githubRepositoryOwner,
        githubRepositoryName,
        githubReleaseName,
      })}`,
    );
    return;
  }

  logger.info(`creating release for ${packageVersion}`);
  // https://developer.github.com/v3/git/tags/
  await githubRESTAPI.POST({
    url: `https://api.github.com/repos/${githubRepositoryOwner}/${githubRepositoryName}/git/refs`,
    githubToken,
    body: {
      ref: `refs/tags/${githubReleaseName}`,
      sha: githubSha,
    },
  });
  logger.info(
    `release created at ${generateReleaseUrl({
      githubRepositoryOwner,
      githubRepositoryName,
      githubReleaseName,
    })}`,
  );
};

const generateReleaseUrl = ({
  githubRepositoryOwner,
  githubRepositoryName,
  githubReleaseName,
}) => {
  return `https://github.com/${githubRepositoryOwner}/${githubRepositoryName}/releases/tag/${githubReleaseName}`;
};

const getOptionsFromGithubAction = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!eventName) {
    throw new Error(
      `missing process.env.GITHUB_EVENT_NAME, we are not in a github action`,
    );
  }
  if (eventName !== "push") {
    throw new Error(
      `getOptionsFromGithubAction must be called only in a push action`,
    );
  }
  const githubRepository = process.env.GITHUB_REPOSITORY;
  if (!githubRepository) {
    throw new Error(`missing process.env.GITHUB_REPOSITORY`);
  }
  const [githubRepositoryOwner, githubRepositoryName] =
    githubRepository.split("/");
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error(`missing process.env.GITHUB_TOKEN`);
  }
  const githubSha = process.env.GITHUB_SHA;
  if (!githubSha) {
    throw new Error(`missing process.env.GITHUB_SHA`);
  }
  return {
    githubRepositoryOwner,
    githubRepositoryName,
    githubToken,
    githubSha,
  };
};
