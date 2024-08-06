import { writeFileSync } from "@jsenv/filesystem";
import { urlToBasename, urlToFilename, urlToRelativeUrl } from "@jsenv/urls";
import { takeDirectorySnapshot } from "../filesystem_snapshot.js";
import { getCallerLocation } from "../get_caller_location.js";
import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderSideEffects, renderSmallLink } from "./render_side_effects.js";

/**
 * Generate a markdown file describing test(s) side effects. When executed in CI throw if there is a diff.
 * @param {URL} sourceFileUrl
 * @param {Function} fnRegisteringTest
 * @param {Object} snapshotTestsOptions
 * @param {string|url} snapshotTestsOptions.outFilePattern
 * @param {string|url} snapshotTestsOptions.rootDirectoryUrl
 * @param {Object} [snapshotTestsOptions.filesystemActions]
 *        Control what to do when there is a file side effect
 *        "compare", "compare_presence_only", "undo", "ignore"
 * @param {Object|boolean} [snapshotTestsOptions.filesystemEffects]
 * @param {boolean} [snapshotTestsOptions.filesystemEffects.textualFilesInline=false]
 *        Put textual files content in the markdown (instead of separate files).
 *        Big files will still be put in dedicated files.
 * @param {boolean} [snapshotTestsOptions.filesystemEffects.preserve=false]
 *        Preserve filesystem side effect when function ends. By default
 *        filesystem effects are undone when function ends
 * @param {url} [snapshotTestsOptions.filesystemEffects.baseDirectory]
 *        Urls of filesystem side effects will be relative to this base directory
 *        Default to the directory containing @sourceFileUrl
 */
export const snapshotTests = async (
  sourceFileUrl,
  fnRegisteringTest,
  {
    outFilePattern = "./_[source_filename]/[filename]",
    filesystemActions = {
      "**": "compare",
      // "**/*.svg": "compare_presence_only",
    },
    rootDirectoryUrl,
    generatedBy = true,
    linkToEachSource,
    errorTransform,
    logEffects,
    filesystemEffects,
    throwWhenDiff = process.env.CI,
  } = {},
) => {
  filesystemActions = {
    ...filesystemActions,
    "**/*.svg": "compare_presence_only",
  };

  const sourceName = urlToBasename(sourceFileUrl, true);
  const sourceBasename = urlToBasename(sourceFileUrl);
  const sourceFilename = urlToFilename(sourceFileUrl);
  const generateOutFileUrl = (outFilename) => {
    const outFileRelativeUrl = outFilePattern
      .replaceAll("[source_name]", sourceName)
      .replaceAll("[source_basename]", sourceBasename)
      .replaceAll("[source_filename]", sourceFilename)
      .replaceAll("[filename]", outFilename);
    const outFileUrl = new URL(outFileRelativeUrl, sourceFileUrl).href;
    return outFileUrl;
  };
  const outDirectoryUrl = generateOutFileUrl("");
  const sideEffectMdFileUrl = generateOutFileUrl(`${sourceFilename}.md`);

  const dirUrlMap = new Map();
  const sideEffectsMap = new Map();
  const testArray = [];
  let index = 0;
  let hasOnly = false;
  const test = (scenario, fn, options) => {
    testArray.push({
      index,
      scenario,
      fn,
      options,
      callSite: getCallerLocation(2),
    });
    index++;
  };
  test.ONLY = (scenario, fn, options) => {
    hasOnly = true;
    testArray.push({
      index,
      scenario,
      fn,
      options,
      callSite: getCallerLocation(2),
      only: true,
    });
    index++;
  };
  const fnReturnValue = await fnRegisteringTest({ test });
  const captureSideEffects = createCaptureSideEffects({
    sourceFileUrl,
    rootDirectoryUrl,
    logEffects,
    filesystemEffects,
    filesystemActions,
  });
  let markdown = "";
  markdown += `# ${sourceName}`;
  markdown += `\n\n`;
  const sourceRelativeUrl = urlToRelativeUrl(
    sourceFileUrl,
    sideEffectMdFileUrl,
    {
      preferRelativeNotation: true,
    },
  );
  markdown += renderSmallLink(
    { text: sourceRelativeUrl, href: sourceRelativeUrl },
    { prefix: "See " },
  );
  markdown += `\n\n`;
  markdown += "## Tests";
  markdown += `\n\n`;
  let outDirectorySnapshot;
  if (testArray.length === 0) {
    outDirectorySnapshot = takeDirectorySnapshot(
      outDirectoryUrl,
      filesystemActions,
    );
    markdown += "No test";
    markdown += "\n";
  } else {
    let allTestMd = "";
    const scenarioDirs = [];
    const scenarioIgnoreActions = {};
    const testToExecuteArray = [];
    for (const testRegistered of testArray) {
      const { scenario, only } = testRegistered;
      const scenarioFilename = asValidFilename(scenario);
      scenarioDirs.push(scenarioFilename);
      const generateScenarioOutFileUrl = (outFilename) => {
        return generateOutFileUrl(`${scenarioFilename}/${outFilename}`);
      };
      const scenarioOutDirectoryUrl = generateScenarioOutFileUrl("");
      dirUrlMap.set(scenario, scenarioOutDirectoryUrl);
      const scenarioMdFileUrl = generateScenarioOutFileUrl(
        `${scenarioFilename}.md`,
      );
      allTestMd += `- ${only ? `ONLY ` : ""}[${scenario}](${urlToRelativeUrl(scenarioMdFileUrl, sideEffectMdFileUrl)})`;
      allTestMd += "\n";
      if (hasOnly && !only) {
        scenarioIgnoreActions[scenarioOutDirectoryUrl] = "ignore";
        continue;
      }
      testRegistered.generateScenarioOutFileUrl = generateScenarioOutFileUrl;
      testRegistered.scenarioMdFileUrl = scenarioMdFileUrl;
      testToExecuteArray.push(testRegistered);
    }
    outDirectorySnapshot = takeDirectorySnapshot(outDirectoryUrl, {
      ...filesystemActions,
      ...scenarioIgnoreActions,
    });
    for (const testToExecute of testToExecuteArray) {
      const {
        scenario,
        fn,
        callSite,
        scenarioMdFileUrl,
        generateScenarioOutFileUrl,
      } = testToExecute;
      const sideEffects = await captureSideEffects(fn, {
        callSite: linkToEachSource ? callSite : undefined,
        baseDirectory: String(new URL("./", callSite.url)),
      });
      sideEffectsMap.set(scenario, sideEffects);
      const sideEffectsMarkdown = renderSideEffects(sideEffects, {
        sideEffectMdFileUrl: scenarioMdFileUrl,
        generateOutFileUrl: generateScenarioOutFileUrl,
        title: scenario,
        errorTransform,
      });
      writeFileSync(scenarioMdFileUrl, sideEffectsMarkdown);
    }
    markdown += allTestMd;
  }
  if (typeof fnReturnValue === "function") {
    await fnReturnValue();
  }
  // if (sideEffectFilePattern === "./side_effects/[filename]/[filename].md") {
  //   const scenarioParentDirUrl = new URL("./", sideEffectFileUrl);
  //   const dirContent = readDirectorySync(scenarioParentDirUrl);
  //   for (const entry of dirContent) {
  //     const entryUrl = new URL(entry, scenarioParentDirUrl);
  //     if (!readEntryStatSync(entryUrl).isDirectory()) {
  //       continue;
  //     }
  //     if (scenarioDirs.includes(entry)) {
  //       continue;
  //     }
  //     removeDirectorySync(entryUrl, {
  //       recursive: true,
  //     });
  //   }
  // }
  if (generatedBy) {
    const generatedByLink = renderSmallLink(
      {
        text: "@jsenv/snapshot",
        href: "https://github.com/jsenv/core/tree/main/packages/independent/snapshot",
      },
      {
        prefix: "Generated by ",
      },
    );
    markdown += "\n";
    markdown += generatedByLink;
  }
  writeFileSync(sideEffectMdFileUrl, markdown);
  outDirectorySnapshot.compare(throwWhenDiff);

  return { dirUrlMap, sideEffectsMap };
};

// see https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const asValidFilename = (string) => {
  return string
    .trim()
    .toLowerCase()
    .replace(/[ ,.]/g, "_")
    .replace(/["/?<>\\:*|]/g, "");
};
