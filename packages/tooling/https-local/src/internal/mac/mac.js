/*
 * see
 * - https://github.com/davewasmer/devcert/blob/master/src/platforms/darwin.ts
 * - https://www.unix.com/man-page/mojave/1/security/
 */

import { executeTrustQueryOnChrome } from "./chrome_mac.js";
import { executeTrustQueryOnFirefox } from "./firefox_mac.js";
import { executeTrustQueryOnMacKeychain } from "./mac_keychain.js";
import { executeTrustQueryOnSafari } from "./safari.js";

export const executeTrustQuery = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  certificate,
  verb,
  NSSDynamicInstall,
}) => {
  const macTrustInfo = await executeTrustQueryOnMacKeychain({
    logger,
    certificateCommonName,
    certificateFileUrl,
    certificateIsNew,
    certificate,
    verb,
  });

  const chromeTrustInfo = await executeTrustQueryOnChrome({
    logger,
    // chrome needs macTrustInfo because it uses OS trust store
    macTrustInfo,
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

  const safariTrustInfo = await executeTrustQueryOnSafari({
    // safari needs macTrustInfo because it uses OS trust store
    macTrustInfo,
  });

  return {
    mac: macTrustInfo,
    chrome: chromeTrustInfo,
    firefox: firefoxTrustInfo,
    safari: safariTrustInfo,
  };
};
