import { readFileSync } from "node:fs";
import { urlToRelativeUrl } from "@jsenv/urls";
import { comparePathnames } from "@jsenv/filesystem";
import { writeSnapshotsIntoDirectory } from "@jsenv/core/tests/snapshots_directory.js";

import { injectSupervisorIntoHTML } from "@jsenv/plugin-supervisor";

let files = {};
const transformFixtureFile = async (fixtureFilename) => {
  const url = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const { content } = await injectSupervisorIntoHTML(
    {
      content: readFileSync(url, "utf8"),
      url: String(url),
    },
    {
      supervisorOptions: {},
      webServer: {
        rootDirectoryUrl: new URL("./fixtures/", import.meta.url),
      },
    },
  );
  const relativeUrl = urlToRelativeUrl(
    url,
    new URL("./fixtures/", import.meta.url),
  );

  files[relativeUrl] = content;
  const filesSorted = {};
  Object.keys(files)
    .sort(comparePathnames)
    .forEach((relativeUrl) => {
      filesSorted[relativeUrl] = files[relativeUrl];
    });
  files = filesSorted;
};

await transformFixtureFile("script_inline.html");
await transformFixtureFile("script_src.html");
await transformFixtureFile("script_type_module_inline.html");
await transformFixtureFile("script_type_module_src.html");

writeSnapshotsIntoDirectory(new URL("./snapshots/", import.meta.url), files);
