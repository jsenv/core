import { formatComment } from "@jsenv/file-size-impact/src/internal/format_comment.js";
import { jsenvCommentParameters } from "@jsenv/file-size-impact/src/internal/jsenv_comment_parameters.js";
import { createGitHubPullRequestCommentText } from "@jsenv/github-pull-request-impact";
import { writeFileSync } from "node:fs";

const generateComment = ({
  beforeMergeFileSizeReport,
  afterMergeFileSizeReport,
  ...rest
}) => {
  const formatCommentParams = {
    pullRequestBase: "base",
    pullRequestHead: "head",
    ...jsenvCommentParameters,
    beforeMergeFileSizeReport: {
      transformationKeys: deduceTransformationKeys(beforeMergeFileSizeReport),
      ...beforeMergeFileSizeReport,
    },
    afterMergeFileSizeReport: {
      transformationKeys: deduceTransformationKeys(afterMergeFileSizeReport),
      ...afterMergeFileSizeReport,
    },
    ...rest,
  };
  const prComment = formatComment(formatCommentParams);
  return createGitHubPullRequestCommentText(prComment);
};

const deduceTransformationKeys = (fileSizeReport) => {
  const groups = fileSizeReport.groups;
  const groupNames = Object.keys(groups);
  if (groupNames.length) {
    const firstGroup = groups[groupNames[0]];
    const fileMap = firstGroup.fileMap;
    const files = Object.keys(fileMap);
    if (files.length) {
      return Object.keys(fileMap[files[0]].sizeMap);
    }
  }

  return [];
};

const examples = {
  "basic example": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 100 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "a",
              sizeMap: { raw: 100 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "b",
              sizeMap: { raw: 110 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "b",
              sizeMap: { raw: 115 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "basic example + gzip + brotli": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 100, gzip: 20, brotli: 18 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "a",
              sizeMap: { raw: 100, gzip: 20, brotli: 18 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "b",
              sizeMap: { raw: 110, gzip: 22, brotli: 19 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "b",
              sizeMap: { raw: 115, gzip: 24, brotli: 21 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "no changes": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 110 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 110 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "no files": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {},
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          tracking: {
            "*/**": false,
          },
          fileMap: {},
        },
      },
    },
  }),
  "changes cancels each other": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/file-a.js": {
              hash: "hash1",
              sizeMap: { raw: 10 },
              meta: true,
            },
            "dist/file-b.js": {
              hash: "hash3",
              sizeMap: { raw: 15 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/file-a.js": {
              hash: "hash2",
              sizeMap: { raw: 15 },
              meta: true,
            },
            "dist/file-b.js": {
              hash: "hash4",
              sizeMap: { raw: 10 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "realist (two groups + gzip + partial)": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        "critical files": {
          fileMap: {
            "dist/foo.js": {
              hash: "a",
              sizeMap: {
                raw: 78450,
                gzip: 32569,
              },
              meta: true,
            },
            "dist/bar.js": {
              hash: "a",
              sizeMap: {
                raw: 45450,
                gzip: 23532,
              },
              meta: true,
            },
          },
        },
        "remaining files": {
          fileMap: {
            "dist/feature.js": {
              hash: "a",
              sizeMap: {
                raw: 7450,
                gzip: 532,
              },
              meta: true,
            },
            "dist/a.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/b.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/c.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/d.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        "critical files": {
          fileMap: {
            "dist/foo.js": {
              hash: "b",
              sizeMap: {
                raw: 85450,
                gzip: 36569,
              },
              meta: true,
            },
            "dist/bar.js": {
              hash: "a",
              sizeMap: {
                raw: 45450,
                gzip: 23532,
              },
              meta: true,
            },
          },
        },
        "remaining files": {
          fileMap: {
            "dist/feature.js": {
              hash: "b",
              sizeMap: {
                raw: 1560,
                gzip: 472,
              },
              meta: true,
            },
            "dist/a.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/b.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/c.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
            "dist/d.js": {
              hash: "a",
              sizeMap: {
                raw: 17450,
                gzip: 9532,
              },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "two groups + gzip + brotli": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        "dist/commonjs": {
          fileMap: {
            "dist/commonjs/bar.js": {
              hash: "a",
              sizeMap: {
                raw: 100,
                gzip: 10,
                brotli: 9,
              },
              meta: true,
            },
            "dist/commonjs/hello.js": {
              hash: "a",
              sizeMap: {
                raw: 167000,
                gzip: 1600,
                brotli: 1500,
              },
              meta: true,
            },
          },
        },
        "dist/systemjs": {
          fileMap: {
            "dist/systemjs/bar.js": {
              hash: "a",
              sizeMap: {
                raw: 100,
                gzip: 10,
                brotli: 9,
              },
              meta: true,
            },
            "dist/systemjs/hello.js": {
              hash: "a",
              sizeMap: {
                raw: 167000,
                gzip: 1600,
                brotli: 1500,
              },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        "dist/commonjs": {
          fileMap: {
            "dist/commonjs/foo.js": {
              hash: "a",
              sizeMap: {
                raw: 120,
                gzip: 12,
                brotli: 11,
              },
              meta: true,
            },
            "dist/commonjs/hello.js": {
              hash: "b",
              sizeMap: {
                raw: 187000,
                gzip: 1800,
                brotli: 1700,
              },
              meta: true,
            },
          },
        },
        "dist/systemjs": {
          fileMap: {
            "dist/systemjs/foo.js": {
              hash: "a",
              sizeMap: {
                raw: 120,
                gzip: 12,
                brotli: 11,
              },
              meta: true,
            },
            "dist/systemjs/hello.js": {
              hash: "b",
              sizeMap: {
                raw: 187000,
                gzip: 1800,
                brotli: 1700,
              },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "zero size impact": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 300 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "a",
              sizeMap: { raw: 2500 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "b",
              sizeMap: { raw: 315 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "b",
              sizeMap: { raw: 2500 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "size impact 0/1": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 100 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "b",
              sizeMap: { raw: 101 },
              meta: {
                showSizeImpact: ({ sizeImpactMap }) =>
                  Math.abs(sizeImpactMap.raw) > 10,
              },
            },
          },
        },
      },
    },
  }),
  "size impact 1/2": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "a",
              sizeMap: { raw: 100 },
              meta: true,
            },
            "dist/foo.js": {
              hash: "a",
              sizeMap: { raw: 101 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/bar.js": {
              hash: "b",
              sizeMap: { raw: 101 },
              meta: {
                showSizeImpact: ({ sizeImpactMap }) =>
                  Math.abs(sizeImpactMap.raw) > 10,
              },
            },
            "dist/foo.js": {
              hash: "b",
              sizeMap: { raw: 115 },
              meta: true,
            },
          },
        },
      },
    },
  }),
  "formating file relative url": generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/foo.js": {
              hash: "a",
              sizeMap: { raw: 101 },
              meta: true,
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            "dist/foo.js": {
              hash: "b",
              sizeMap: { raw: 115 },
              meta: {
                formatFileRelativeUrl: (relativeUrl) =>
                  relativeUrl.slice("dist/".length),
              },
            },
          },
        },
      },
    },
  }),
  "empty warning": generateComment({
    beforeMergeFileSizeReport: {
      groups: {},
    },
    afterMergeFileSizeReport: {
      groups: {},
    },
  }),
};

{
  const fileMap = {};
  new Array(100).fill("").forEach((_, index) => {
    const fileName = `${index}.js`;
    fileMap[fileName] = {
      hash: index,
      sizeMap: {
        raw: index * 100,
        gzip: index * 20,
      },
      meta: true,
    };
  });

  examples["lot of files"] = generateComment({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap,
        },
      },
    },
    afterMergeFileSizeReport: {
      groups: {
        dist: {
          fileMap: {
            ...fileMap,
            "0.js": {
              hash: "toto",
              sizeMap: {
                raw: 0,
                gzip: 0,
              },
              meta: true,
            },
            "1.js": {
              hash: "toto",
              sizeMap: {
                raw: 2000,
                gzip: 200,
              },
              meta: true,
            },
            "2.js": {
              hash: "toto",
              sizeMap: {
                raw: 20,
                gzip: 10,
              },
              meta: true,
            },
          },
        },
      },
    },
  });
}

const snapshotFileUrl = new URL("./comment_snapshot.md", import.meta.url);
const snapshotFileContent = Object.keys(examples).map((exampleName) => {
  return `# ${exampleName}

${examples[exampleName]}`;
}).join(`

`);
writeFileSync(
  snapshotFileUrl,
  `${snapshotFileContent}
`,
);
