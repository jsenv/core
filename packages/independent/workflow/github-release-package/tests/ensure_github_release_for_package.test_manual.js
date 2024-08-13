import { ensureGithubReleaseForPackage } from "@jsenv/github-release-package";
// import secrets from "../secrets.json"

// Object.assign(process.env, secrets)

const rootDirectoryUrl = new URL("../", import.meta.url);

process.env.GITHUB_EVENT_NAME = "push";
process.env.GITHUB_REPOSITORY = "jsenv/jsenv-auto-publish";
process.env.GITHUB_SHA = "b1bd0020316c53b5837110fb9eb1139b6e495408";

ensureGithubReleaseForPackage({
  rootDirectoryUrl,
  logLevel: "debug",
});
