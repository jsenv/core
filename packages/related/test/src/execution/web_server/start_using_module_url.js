import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { startServerUsingCommand } from "./start_using_command.js";

export const startServerUsingModuleUrl = async (webServer, params) => {
  if (!existsSync(new URL(webServer.moduleUrl))) {
    throw new Error(`"${webServer.moduleUrl}" does not lead to a file`);
  }
  let command = `node`;
  if (process.execArgv.length > 0) {
    command += ` ${process.execArgv.join(" ")}`;
  }
  command += ` ${fileURLToPath(webServer.moduleUrl)}`;

  return startServerUsingCommand(
    {
      ...webServer,
      command,
      args: ["--jsenv-test"],
    },
    params,
  );
};
