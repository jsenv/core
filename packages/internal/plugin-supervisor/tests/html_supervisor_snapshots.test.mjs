import { readFileSync } from "node:fs";
import { urlToFilename } from "@jsenv/urls";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { injectSupervisorIntoHTML } from "@jsenv/plugin-supervisor";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const test = async (fixtureFilename) => {
  const fileUrl = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const fileSnapshotUrl = new URL(
    `./snapshots/${fixtureFilename}`,
    import.meta.url,
  );
  const originalContent = readFileSync(fileUrl, "utf8");
  const { content } = await injectSupervisorIntoHTML(
    {
      content: originalContent,
      url: String(fileUrl),
    },
    {
      supervisorScriptSrc: "supervisor.js",
      supervisorOptions: {},
      webServer: {
        rootDirectoryUrl: new URL("file:///web_root_directory_url/"),
      },
      generateInlineScriptSrc: ({ inlineScriptUrl }) => {
        return urlToFilename(inlineScriptUrl);
      },
      sourcemaps: "none",
    },
  );

  writeFileSync(fileSnapshotUrl, content);
};

const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
await test("script_inline.html");
await test("script_src.html");
await test("script_type_module_inline.html");
await test("script_type_module_src.html");
directorySnapshot.compare();
