/*
 * see
 * - https://github.com/davewasmer/devcert/blob/master/src/platforms/darwin.ts
 * - https://www.unix.com/man-page/mojave/1/security/
 */

import { executeTrustQueryOnChrome } from "./chrome_windows.js";
import { executeTrustQueryOnEdge } from "./edge.js";
import { executeTrustQueryOnFirefox } from "./firefox_windows.js";
import { executeTrustQueryOnWindows } from "./windows_certutil.js";

export const executeTrustQuery = async ({
  logger,
  certificateCommonName,
  certificateFileUrl,
  certificateIsNew,
  verb,
}) => {
  const windowsTrustInfo = await executeTrustQueryOnWindows({
    logger,
    certificateCommonName,
    certificateFileUrl,
    certificateIsNew,
    verb,
  });

  const chromeTrustInfo = await executeTrustQueryOnChrome({
    logger,
    windowsTrustInfo,
  });

  const edgeTrustInfo = await executeTrustQueryOnEdge({
    windowsTrustInfo,
  });

  const firefoxTrustInfo = await executeTrustQueryOnFirefox({
    logger,
    certificateIsNew,
  });

  return {
    windows: windowsTrustInfo,
    chrome: chromeTrustInfo,
    edge: edgeTrustInfo,
    firefox: firefoxTrustInfo,
  };
};
