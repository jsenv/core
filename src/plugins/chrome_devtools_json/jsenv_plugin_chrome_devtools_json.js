/**
 * https://docs.google.com/document/d/1rfKPnxsNuXhnF7AiQZhu9kIwdiMS5hnAI05HBwFuBSM/edit?tab=t.0#heading=h.7nki9mck5t64
 * https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md
 * https://github.com/ChromeDevTools/vite-plugin-devtools-json
 */

import { writeFileSync } from "@jsenv/filesystem";
import { urlToFileSystemPath } from "@jsenv/urls";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const jsenvPluginChromeDevtoolsJson = () => {
  const getOrCreateUUID = (kitchen) => {
    const { outDirectoryUrl } = kitchen.context;
    const uuidFileUrl = new URL("./uuid.json", outDirectoryUrl);
    if (existsSync(uuidFileUrl)) {
      const { uuid } = JSON.parse(readFileSync(uuidFileUrl, "utf8"));
      return uuid;
    }
    const uuid = randomUUID();
    writeFileSync(uuidFileUrl, JSON.stringify({ uuid }), { encoding: "utf8" });
    return uuid;
  };

  return {
    name: "jsenv_plugin_chrome_devtools_json",
    appliesDuring: "dev",
    devServerRoutes: [
      {
        endpoint: "GET /.well-known/appspecific/com.chrome.devtools.json",
        fetch: (request, { kitchen }) => {
          const { rootDirectoryUrl } = kitchen.context;
          return Response.json({
            workspace: {
              root: urlToFileSystemPath(rootDirectoryUrl),
              uuid: getOrCreateUUID(kitchen),
            },
          });
        },
      },
    ],
  };
};
