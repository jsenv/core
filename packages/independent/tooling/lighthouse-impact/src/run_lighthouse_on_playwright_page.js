import { generateLighthouseReport } from "./generate/generate_lighthouse_report.js";

export const runLighthouseOnPlaywrightPage = async (
  page,
  { chromiumDebuggingPort, ...options },
) => {
  const url = page.url();
  const userAgent = await page.evaluate(() => {
    /* eslint-disable no-undef */
    return navigator.userAgent;
    /* eslint-enable no-undef */
  });
  const deviceScaleFactor = await page.evaluate(() => {
    /* eslint-disable no-undef */
    return window.devicePixelRatio;
    /* eslint-enable no-undef */
  });
  const { screenWidth, screenHeight } = await page.evaluate(() => {
    /* eslint-disable no-undef */
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    };
    /* eslint-enable no-undef */
  });
  // see "isMobile" into https://playwright.dev/docs/api/class-browser#browser-new-context
  const viewportMetaTakenIntoAccount = await page.evaluate(() => {
    /* eslint-disable no-undef */
    let mutate;
    const viewportWidthNow = window.innerWidth;
    const viewportMeta = document.head.querySelector("meta[name=viewport]");
    if (viewportMeta) {
      mutate = () => {
        const content = viewportMeta.content;
        viewportMeta.setAttribute("content", `width=${viewportWidthNow + 1}`);
        return () => {
          viewportMeta.setAttribute("content", content);
        };
      };
    } else {
      mutate = () => {
        const viewportMeta = document.createElement("meta");
        viewportMeta.name = "viewport";
        viewportMeta.setAttribute("content", `width=${viewportWidthNow + 1}`);
        document.head.appendChild(viewportMeta);
        return () => {
          document.head.removeChild(viewportMeta);
        };
      };
    }
    const cleanup = mutate();
    const viewportWidthAfter = window.innerWidth;
    cleanup();
    const viewportMetaTakenIntoAccount =
      viewportWidthAfter !== viewportWidthNow;
    return viewportMetaTakenIntoAccount;
    /* eslint-enable no-undef */
  });

  const report = await generateLighthouseReport(url, {
    chromiumDebuggingPort,
    emulatedScreenWidth: screenWidth,
    emulatedScreenHeight: screenHeight,
    emulatedDeviceScaleFactor: deviceScaleFactor,
    emulatedMobile: viewportMetaTakenIntoAccount,
    emulatedUserAgent: userAgent,
    ...options,
  });
  return report;
};
