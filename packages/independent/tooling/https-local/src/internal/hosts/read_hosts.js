import { readFile } from "@jsenv/filesystem";
import { HOSTS_FILE_PATH } from "./hosts_utils.js";

export const readHostsFile = async (hostsFilePath = HOSTS_FILE_PATH) => {
  const hostsFileContent = await readFile(hostsFilePath, { as: "string" });
  return hostsFileContent;
};
