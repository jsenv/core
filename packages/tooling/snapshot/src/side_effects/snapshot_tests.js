import { writeFileSync } from "@jsenv/filesystem";
import { urlToBasename, urlToFilename, urlToRelativeUrl } from "@jsenv/urls";
import { takeDirectorySnapshot } from "../filesystem_snapshot.js";
import { getCallerLocation } from "../get_caller_location.js";
import {
  createCaptureSideEffects,
  ignoreSideEffects,
} from "./create_capture_side_effects.js";
import { renderSideEffects, renderSmallLink } from "./render_side_effects.js";

/**
 * Generate a markdown file describing test(s) side effects. When executed in CI throw if there is a diff.
 * @param {URL} sourceFileUrl
 * @param {Function} fnRegisteringTest
 * @param {Object} snapshotTestsOptions
 * @param {string|url} snapshotTestsOptions.outFilePattern
 * @param {string|url} snapshotTestsOptions.rootDirectoryUrl
 * @param {Object} [snapshotTestsOptions.executionEffects]
 * @param {boolean} [snapshotTestsOptions.executionEffects.catch=true]
 *        Any error thrown by test function is detected and added to side effects
 * @param {boolean} [snapshotTestsOptions.executionEffects.return=true]
 *        Test function return value is added to side effects
 * @param {Object} [snapshotTestsOptions.logEffects]
 *        Control how console outputs are captured and included in side effects
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
let preconfiguredOptions = null;
export const snapshotTests = async (
  sourceFileUrl,
  fnRegisteringTest,
  options = {},
) => {
  if (preconfiguredOptions) {
    Object.assign(options, preconfiguredOptions);
    preconfiguredOptions = null;
  }
  let {
    outFilePattern = "./_[source_filename]/[filename]",
    filesystemActions,
    rootDirectoryUrl,
    generatedBy = true,
    executionEffects,
    logEffects,
    filesystemEffects,
    throwWhenDiff = process.env.CI,
    sourceLocation = false,
  } = options;
  filesystemActions = {
    "**": "compare",
    ...options.filesystemActions,
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
  const scenariosSet = new Set();
  const test = (scenario, fn, options) => {
    if (scenariosSet.has(scenario)) {
      console.warn(`"${scenario}" overrides`);
    }
    scenariosSet.add(scenario);
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
    if (scenariosSet.has(scenario)) {
      console.warn(`"${scenario}" overrides`);
    }
    scenariosSet.add(scenario);
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
    executionEffects,
    logEffects,
    filesystemEffects,
    filesystemActions,
  });
  const sourceRelativeUrl = urlToRelativeUrl(
    sourceFileUrl,
    sideEffectMdFileUrl,
    {
      preferRelativeNotation: true,
    },
  );
  let markdown = "";
  markdown += `# [${urlToFilename(sourceFileUrl)}](${sourceRelativeUrl})`;
  markdown += `\n\n`;
  let testMd = "";
  testMd += `\n`;
  let outDirectorySnapshot;
  if (testArray.length === 0) {
    outDirectorySnapshot = takeDirectorySnapshot(
      outDirectoryUrl,
      filesystemActions,
    );
    testMd += "No test";
    testMd += "\n";
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
      allTestMd += `- [${scenario}](${urlToRelativeUrl(scenarioMdFileUrl, sideEffectMdFileUrl)})`;
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
        baseDirectory: String(new URL("./", callSite.url)),
      });
      sideEffectsMap.set(scenario, sideEffects);
      const sideEffectsMarkdown = renderSideEffects(sideEffects, {
        sourceFileUrl: sourceLocation
          ? `${callSite.url}#L${callSite.line}`
          : callSite.url,
        sideEffectMdFileUrl: scenarioMdFileUrl,
        generateOutFileUrl: generateScenarioOutFileUrl,
        title: scenario,
        sourceLocation,
      });
      writeFileSync(scenarioMdFileUrl, sideEffectsMarkdown);
    }
    testMd += allTestMd;
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
  markdown += testMd;
  if (generatedBy) {
    markdown += "\n";
    markdown += "---";
    markdown += "\n\n";
    markdown += renderSmallLink(
      {
        text: "@jsenv/snapshot",
        href: "https://github.com/jsenv/core/tree/main/packages/tooling/snapshot",
      },
      { prefix: "Generated by " },
    );
    markdown += "\n";
  }
  writeFileSync(sideEffectMdFileUrl, markdown);
  outDirectorySnapshot.compare(throwWhenDiff);

  return { dirUrlMap, sideEffectsMap };
};
// preConfigure is just so that when we update the snapshot test options
// it does not influence too much the formatting
// snapshotTests(import.meta.url, ({ test }) => { }, options)
// becomes
// snapshotTests.prefConfigure(options)
// snapshotTests(import.meta.url, ({ test }) => { })
// which are equivalent
snapshotTests.prefConfigure = (options) => {
  preconfiguredOptions = options;
};

snapshotTests.ignoreSideEffects = ignoreSideEffects;

// see https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const asValidFilename = (string) => {
  return string
    .trim()
    .toLowerCase()
    .replace(/[ ,.]/g, "_")
    .replace(/["/?<>\\:*|]/g, "");
};
