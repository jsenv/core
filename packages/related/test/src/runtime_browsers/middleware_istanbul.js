import { applyBabelPlugins } from "@jsenv/ast";
import { SOURCEMAP, generateSourcemapDataUrl } from "@jsenv/sourcemap";
import { URL_META } from "@jsenv/url-meta";

import { babelPluginInstrument } from "../coverage/babel_plugin_instrument.js";
import { WEB_URL_CONVERTER } from "../helpers/web_url_converter.js";

export const initIstanbulMiddleware = async (
  page,
  { webServer, rootDirectoryUrl, coverageInclude },
) => {
  const associations = URL_META.resolveAssociations(
    { cover: coverageInclude },
    rootDirectoryUrl,
  );
  await page.route("**", async (route) => {
    const request = route.request();
    const url = request.url(); // transform into a local url
    const fileUrl = WEB_URL_CONVERTER.asFileUrl(url, webServer);
    const needsInstrumentation = URL_META.applyAssociations({
      url: fileUrl,
      associations,
    }).cover;
    if (!needsInstrumentation) {
      route.fallback();
      return;
    }
    const response = await route.fetch();
    const originalBody = await response.text();
    try {
      const result = await applyBabelPlugins({
        babelPlugins: [babelPluginInstrument],
        input: originalBody,
        // jsenv server could send info to know it's a js module or js classic
        // but in the end it's not super important
        // - it's ok to parse js classic as js module considering it's only for istanbul instrumentation
        inputIsJsModule: true,
        inputUrl: fileUrl,
      });
      let code = result.code;
      code = SOURCEMAP.writeComment({
        contentType: "text/javascript",
        content: code,
        specifier: generateSourcemapDataUrl(result.map),
      });
      route.fulfill({
        response,
        body: code,
        headers: {
          ...response.headers(),
          "content-length": Buffer.byteLength(code),
        },
      });
    } catch (e) {
      if (e.code === "PARSE_ERROR") {
        route.fulfill({ response });
      } else {
        console.error(e);
        route.fulfill({ response });
      }
    }
  });
};
