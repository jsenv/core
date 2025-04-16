import { writeFileSync } from "@jsenv/filesystem";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { injectSupervisorIntoHTML } from "@jsenv/plugin-supervisor";
import { snapshotSideEffects } from "@jsenv/snapshot";
import { urlToFilename } from "@jsenv/urls";
import { readFileSync } from "node:fs";

const run = async (fixtureFilename) => {
  const fileUrl = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const outFileUrl = new URL(`./output/${fixtureFilename}`, import.meta.url);
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
  writeFileSync(outFileUrl, content);
};

await snapshotSideEffects(import.meta.url, async () => {
  await run("script_inline.html");
  await run("script_src.html");
  await run("script_type_module_inline.html");
  await run("script_type_module_src.html");
});
