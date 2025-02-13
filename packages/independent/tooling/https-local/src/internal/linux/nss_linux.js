// https://github.com/FiloSottile/mkcert/issues/447

import { UNICODE } from "@jsenv/humanize";
import { exec } from "../exec.js";
import { memoize } from "../memoize.js";

export const nssCommandName = "libnss3-tools";

export const detectIfNSSIsInstalled = memoize(async ({ logger }) => {
  logger.debug(`Detect if nss installed....`);

  const aptCommand = `apt list libnss3-tools --installed`;
  logger.debug(`${UNICODE.COMMAND} ${aptCommand}`);
  const aptCommandOutput = await exec(aptCommand);

  if (aptCommandOutput.includes("libnss3-tools")) {
    logger.debug(`${UNICODE.OK} libnss3-tools is installed`);
    return true;
  }

  logger.debug(`${UNICODE.INFO} libnss3-tools not installed`);
  return false;
});

export const getCertutilBinPath = () => "certutil";

export const getNSSDynamicInstallInfo = ({ logger }) => {
  return {
    isInstallable: true,
    install: async () => {
      const aptInstallCommand = `sudo apt install libnss3-tools`;
      logger.info(
        `"libnss3-tools" is not installed, trying to install "libnss3-tools"`,
      );
      logger.info(`${UNICODE.COMMAND} ${aptInstallCommand}`);
      await exec(aptInstallCommand);
    },
  };
};
