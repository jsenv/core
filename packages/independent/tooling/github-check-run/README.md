# GitHub check run [![npm package](https://img.shields.io/npm/v/@jsenv/github-check-run.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/github-check-run)

```js
import { startGithubCheckRun } from "@jsenv/github-check-run";

const values = [1_000, 2_000, 4_000];

const githubCheck = await startGithubCheckRun({
  githubToken: "",
  repositoryOwner: "dmail",
  repositoryName: "repo-name",
  commitSha: "",
  checkName: "demo",
  checkTitle: "Running demo",
  checkSummary: `preparing execution of ${values.length} timeouts`,
});

try {
  let index = 0;
  for (const value of values) {
    githubCheck.progress({
      summary: `executing timeout ${index + 1}/${values.length}`,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, value);
    });
    index++;
  }
  await githubCheck.pass({
    summary: `${values.length} timeout execution done`,
  });
} catch (e) {
  await githubCheck.fail({
    summary: `error while executing timeout number ${index + 1}: ${e.stack}`,
  });
}
```

If the code is executed inside a Github workflow, several parameters can be retrieved using `readGitHubWorkflowEnv`:

```js
import {
  startGithubCheckRun,
  readGitHubWorkflowEnv,
} from "@jsenv/github-check-run";

const githubCheck = await startGithubCheckRun({
  ...readGitHubWorkflowEnv(),
  checkName: "demo",
  checkTitle: "Running demo",
  checkSummary: `Executing ${values.length} setTimeouts`,
});
```
