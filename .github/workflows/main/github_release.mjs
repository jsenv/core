import { ensureGithubReleaseForPackage } from "@jsenv/github-release-package"

await ensureGithubReleaseForPackage({
  rootDirectoryUrl: new URL("../../../", import.meta.url),
})
