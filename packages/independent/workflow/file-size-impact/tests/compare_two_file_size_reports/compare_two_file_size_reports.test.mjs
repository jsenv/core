import { assert } from "@jsenv/assert";
import { compareTwoFileSizeReports } from "@jsenv/file-size-impact/src/internal/compare_two_file_size_reports.js";

{
  const actual = compareTwoFileSizeReports({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          tracking: {
            "foo.js": true,
          },
          manifestMap: {
            "manifest.json": {
              "foo.js": "foo-hash.js",
            },
          },
          fileMap: {
            "foo-hash.js": { hash: "hash" },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      transformationKeys: ["raw"],
      groups: {
        dist: {
          tracking: {
            "foo.js": true,
          },
          manifestMap: {
            "manifest.json": {
              "foo.js": "foo-hash2.js",
            },
          },
          fileMap: {
            "foo-hash2.js": { hash: "hash2" },
          },
        },
      },
    },
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "foo.js": true,
        },
        fileImpactMap: {
          "foo-hash2.js": {
            beforeMerge: {
              relativeUrl: "foo-hash.js",
              manifestKey: "foo.js",
              hash: "hash",
            },
            afterMerge: {
              relativeUrl: "foo-hash2.js",
              manifestKey: "foo.js",
              hash: "hash2",
            },
          },
        },
      },
    },
  };
  assert({ actual, expect });
}

{
  const actual = compareTwoFileSizeReports({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          tracking: {
            "**/*": true,
          },
          manifestMap: {
            "manifest.json": {
              "dir/file.js": "dir/file.beforeMerge.js",
              "old.js": "old.beforeMerge.js",
            },
          },
          fileMap: {
            "dir/file.beforeMerge.js": { hash: "hash1" },
            "old.beforeMerge.js": { hash: "hash2" },
            "whatever.js": { hash: "hash3" },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      transformationKeys: ["raw"],
      groups: {
        dist: {
          tracking: {
            "**/*": true,
          },
          manifestMap: {
            "manifest.json": {
              "dir/file.js": "dir/file.afterMerge.js",
              "new.js": "new.afterMerge.js",
            },
          },
          fileMap: {
            "dir/file.afterMerge.js": { hash: "hash4" },
            "new.afterMerge.js": { hash: "hash5" },
            "whatever.js": { hash: "hash6" },
          },
        },
      },
    },
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "**/*": true,
        },
        fileImpactMap: {
          "dir/file.afterMerge.js": {
            beforeMerge: {
              relativeUrl: "dir/file.beforeMerge.js",
              manifestKey: "dir/file.js",
              hash: "hash1",
            },
            afterMerge: {
              relativeUrl: "dir/file.afterMerge.js",
              manifestKey: "dir/file.js",
              hash: "hash4",
            },
          },
          "new.afterMerge.js": {
            beforeMerge: null,
            afterMerge: {
              relativeUrl: "new.afterMerge.js",
              manifestKey: "new.js",
              hash: "hash5",
            },
          },
          "old.beforeMerge.js": {
            beforeMerge: {
              relativeUrl: "old.beforeMerge.js",
              manifestKey: "old.js",
              hash: "hash2",
            },
            afterMerge: null,
          },
          "whatever.js": {
            beforeMerge: {
              relativeUrl: "whatever.js",
              manifestKey: null,
              hash: "hash3",
            },
            afterMerge: {
              relativeUrl: "whatever.js",
              manifestKey: null,
              hash: "hash6",
            },
          },
        },
      },
    },
  };
  assert({ actual, expect });
}

// mapped + ignored file
{
  const actual = compareTwoFileSizeReports({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          tracking: {
            "foo.html": false,
          },
          manifestMap: {
            "manifest.json": {
              "foo.html": "bar.html",
            },
          },
          fileMap: {
            "whatever.js": { hash: "hash" },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      transformationKeys: ["raw"],
      groups: {
        dist: {
          tracking: {
            "foo.html": false,
          },
          manifestMap: {
            "manifest.json": {
              "foo.html": "bar.html",
            },
          },
          fileMap: {
            "whatever.js": { hash: "hash2" },
          },
        },
      },
    },
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "foo.html": false,
        },
        fileImpactMap: {
          "whatever.js": {
            beforeMerge: {
              relativeUrl: "whatever.js",
              manifestKey: null,
              hash: "hash",
            },
            afterMerge: {
              relativeUrl: "whatever.js",
              manifestKey: null,
              hash: "hash2",
            },
          },
        },
      },
    },
  };
  assert({ actual, expect });
}

// a mapping after merge refer to the same file before merge
// but leads to a file that is not in fileMap
{
  const actual = compareTwoFileSizeReports({
    beforeMergeFileSizeReport: {
      groups: {
        dist: {
          tracking: {
            "**/*": true,
          },
          manifestMap: {
            "dist/cdn/manifest.json": {
              "svg_critical.js": "dmp.svg_critical.2202bba64ea46ecc7424.js",
            },
          },
          fileMap: {
            "dist/cdn/dmp.svg_critical.2202bba64ea46ecc7424.js": {
              sizeMap: { raw: 11684 },
              hash: '"2da4-3NMwjvenZ2aks5RKh8BPcDEnaco"',
            },
          },
        },
      },
    },
    afterMergeFileSizeReport: {
      transformationKeys: ["raw"],
      groups: {
        dist: {
          tracking: {
            "**/*": true,
          },
          manifestMap: {
            "dist/cdn/manifest.json": {
              "svg_critical.js":
                "/player/neondmp.svg_critical.2202bba64ea46ecc7424.js",
            },
          },
          fileMap: {
            "dist/cdn/dmp.svg_critical.2202bba64ea46ecc7424.js": {
              sizeMap: { raw: 11684 },
              hash: '"2da4-3NMwjvenZ2aks5RKh8BPcDEnaco"',
            },
          },
        },
      },
    },
  });
  const expect = {
    transformationKeys: ["raw"],
    groups: {
      dist: {
        tracking: {
          "**/*": true,
        },
        fileImpactMap: {
          "dist/cdn/dmp.svg_critical.2202bba64ea46ecc7424.js": {
            beforeMerge: {
              relativeUrl: "dist/cdn/dmp.svg_critical.2202bba64ea46ecc7424.js",
              manifestKey: "dist/cdn/svg_critical.js",
              sizeMap: {
                raw: 11684,
              },
              hash: '"2da4-3NMwjvenZ2aks5RKh8BPcDEnaco"',
            },
            afterMerge: {
              relativeUrl: "dist/cdn/dmp.svg_critical.2202bba64ea46ecc7424.js",
              manifestKey: null,
              sizeMap: {
                raw: 11684,
              },
              hash: '"2da4-3NMwjvenZ2aks5RKh8BPcDEnaco"',
            },
          },
        },
      },
    },
  };
  assert({ actual, expect });
}
