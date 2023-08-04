import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { startServerUsingCommand } from "./start_using_command.js";

export const startServerUsingModuleUrl = async (webServer, params) => {
  if (!existsSync(new URL(webServer.moduleUrl))) {
    throw new Error(`"${webServer.moduleUrl}" does not lead to a file`);
  }
  return startServerUsingCommand(
    {
      ...webServer,
      command: `node ${fileURLToPath(webServer.moduleUrl)}`,
    },
    params,
  );
};
