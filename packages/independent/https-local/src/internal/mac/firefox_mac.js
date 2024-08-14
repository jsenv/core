import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { UNICODE, createTaskLog } from "@jsenv/humanize";
import { execSync } from "node:child_process";
import { executeTrustQueryOnBrowserNSSDB } from "../nssdb_browser.js";
import {
  detectIfNSSIsInstalled,
  getCertutilBinPath,
  getNSSDynamicInstallInfo,
  nssCommandName,
} from "./nss_mac.js";

export const executeTrustQueryOnFirefox = ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
  NSSDynamicInstall,
}) => {
  return executeTrustQueryOnBrowserNSSDB({
    logger,
    certificateCommonName,
    certificateFileUrl,
    certificateIsNew,
    certificate,

    verb,
    NSSDynamicInstall,
    nssCommandName,
    detectIfNSSIsInstalled,
    getNSSDynamicInstallInfo,
    getCertutilBinPath,

    browserName: "firefox",
    browserPaths: [
      "/Applications/Firefox.app",
      "/Applications/FirefoxDeveloperEdition.app",
      "/Applications/Firefox Developer Edition.app",
      "/Applications/Firefox Nightly.app",
    ],
    browserNSSDBDirectoryUrls: [
      new URL(
        `./Library/Application Support/Firefox/Profiles/`,
        assertAndNormalizeDirectoryUrl(process.env.HOME),
      ),
    ],
    getBrowserClosedPromise: async () => {
      if (!isFirefoxOpen()) {
        return;
      }

      logger.warn(
        `${UNICODE.WARNING} firefox is running, it must be stopped before resuming...`,
      );
      const closeFirefoxTask = createTaskLog("waiting for firefox to close");
      const next = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (isFirefoxOpen()) {
          await next();
        } else {
          closeFirefoxTask.done();
          // wait 50ms more to ensure firefox has time to cleanup
          // othrwise sometimes there is an SEC_ERROR_REUSED_ISSUER_AND_SERIAL error
          // because we updated nss database file while firefox is not fully closed
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };
      await next();
    },
  });
};

const isFirefoxOpen = () => {
  const psAux = execSync("ps aux");
  return psAux.includes("Firefox.app");
};
