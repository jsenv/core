import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { UNICODE } from "@jsenv/humanize";
import { execSync } from "node:child_process";
import { executeTrustQueryOnBrowserNSSDB } from "../nssdb_browser.js";
import {
  detectIfNSSIsInstalled,
  getCertutilBinPath,
  getNSSDynamicInstallInfo,
  nssCommandName,
} from "./nss_linux.js";

export const executeTrustQueryOnChrome = ({
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

    browserName: "chrome",
    browserPaths: ["/usr/bin/google-chrome"],
    // chromium seems to use its own store and not ".pki/nssdb" anymore
    // as explained in https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md
    browserNSSDBDirectoryUrls: [
      new URL(".pki/nssdb", assertAndNormalizeDirectoryUrl(process.env.HOME)),
      new URL(
        "snap/chromium/current/.pki/nssdb",
        assertAndNormalizeDirectoryUrl(process.env.HOME),
      ), // Snapcraft
      "file:///etc/pki/nssdb", // CentOS 7
    ],
    getBrowserClosedPromise: async () => {
      if (!isChromeOpen()) {
        return;
      }

      logger.warn(
        `${UNICODE.WARNING} waiting for you to close Chrome before resuming...`,
      );
      const next = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (isChromeOpen()) {
          await next();
        } else {
          logger.info(`${UNICODE.OK} Chrome closed, resuming`);
          // wait 50ms more to ensure chrome has time to cleanup
          // othrwise sometimes there is an SEC_ERROR_REUSED_ISSUER_AND_SERIAL error
          // because we updated nss database file while chrome is not fully closed
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };
      await next();
    },
  });
};

const isChromeOpen = () => {
  return execSync("ps aux").includes("google chrome");
};
