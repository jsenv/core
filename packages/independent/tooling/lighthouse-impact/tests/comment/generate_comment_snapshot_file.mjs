/**

https://github.com/actions/toolkit/tree/master/packages/exec
https://github.com/actions/toolkit/tree/master/packages/core

*/

import { createGitHubPullRequestCommentText } from "@jsenv/github-pull-request-impact";
import { createLighthouseImpactComment } from "@jsenv/lighthouse-impact/src/pr_impact/create_lighthouse_impact_comment.js";
import { jsenvCommentParameters } from "@jsenv/lighthouse-impact/src/pr_impact/jsenv_comment_parameters.js";
import { readFileSync, writeFileSync } from "node:fs";

const generateComment = (data) => {
  return createGitHubPullRequestCommentText(
    createLighthouseImpactComment({
      pullRequestBase: "base",
      pullRequestHead: "head",
      ...jsenvCommentParameters,
      ...data,
    }),
  );
};

const normalReport = JSON.parse(
  String(
    readFileSync(
      new URL("./lighthouse_report_examples/normal.json", import.meta.url),
    ),
  ),
);

const examples = {
  "basic": generateComment({
    beforeMergeLighthouseReport: {
      audits: {
        whatever: {
          score: 0.5,
          scoreDisplayMode: "numeric",
          description: "whatever description",
        },
        foo: {
          score: 0,
          scoreDisplayMode: "binary",
          description: "foo description",
        },
      },
      categories: {
        perf: {
          score: 0.8,
          description: "Total perf score",
        },
      },
    },
    afterMergeLighthouseReport: {
      audits: {
        whatever: {
          score: 0.7,
          scoreDisplayMode: "numeric",
          description: "whatever description",
        },
        foo: {
          score: 1,
          scoreDisplayMode: "binary",
          description: "foo description",
        },
      },
      categories: {
        perf: {
          score: 0.9,
          auditRefs: [{ id: "whatever" }, { id: "foo" }],
          description: "Total perf score",
        },
      },
    },
    beforeMergeGist: { id: "base" },
    afterMergeGist: { id: "head" },
  }),
  "version mismatch": generateComment({
    beforeMergeLighthouseReport: {
      lighthouseVersion: "1.0.0",
    },
    afterMergeLighthouseReport: {
      lighthouseVersion: "1.0.1",
    },
    beforeMergeGist: { id: "base" },
    afterMergeGist: { id: "head" },
  }),
  "real": generateComment({
    beforeMergeLighthouseReport: normalReport,
    afterMergeLighthouseReport: normalReport,
    beforeMergeGist: { id: "base" },
    afterMergeGist: { id: "head" },
  }),
};

const exampleFileUrl = new URL("./comment_snapshot.md", import.meta.url);
const exampleFileContent = Object.keys(examples).map((exampleName) => {
  return `# ${exampleName}

${examples[exampleName]}`;
}).join(`

`);
writeFileSync(
  exampleFileUrl,
  `${exampleFileContent}
`,
);
