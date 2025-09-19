import { executeTrustQueryOnChrome } from "./chrome_linux.js";
import { executeTrustQueryOnFirefox } from "./firefox_linux.js";
import { executeTrustQueryOnLinux } from "./linux_trust_store.js";

export const executeTrustQuery = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
  NSSDynamicInstall,
}) => {
  const linuxTrustInfo = await executeTrustQueryOnLinux({
    logger,
    certificateFileUrl,
    certificateIsNew,
    certificate,
    verb,
  });

  const chromeTrustInfo = await executeTrustQueryOnChrome({
    logger,
    certificateCommonName,
    certificateFileUrl,
    certificateIsNew,
    certificate,
    verb,
    NSSDynamicInstall,
  });

  const firefoxTrustInfo = await executeTrustQueryOnFirefox({
    logger,
    certificateCommonName,
    certificateFileUrl,
    certificateIsNew,
    certificate,
    verb,
    NSSDynamicInstall,
  });

  return {
    linux: linuxTrustInfo,
    chrome: chromeTrustInfo,
    firefox: firefoxTrustInfo,
  };
};
