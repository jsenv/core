/*
 * Each @import found in css is replaced by the file content
 * - There is no need to worry about urls (such as background-image: url())
 *   because they are absolute (file://*) and will be made relative again by jsenv build
 * - The sourcemap are not generated but ideally they should be
 *   It can be quite challenging, see "bundle_sourcemap.js"
 */

import { createMagicSource } from "@jsenv/sourcemap";

import { applyPostCss } from "../src/css/apply_post_css.js";
import { postCssPluginUrlVisitor } from "../src/css/postcss_plugin_url_visitor.js";

import { sortByDependencies } from "./sort_by_dependencies.js";

export const bundleCss = async (cssUrlInfos) => {
  const bundledCssUrlInfos = {};
  const cssBundleInfos = await performCssBundling(cssUrlInfos);
  cssUrlInfos.forEach((cssUrlInfo) => {
    bundledCssUrlInfos[cssUrlInfo.url] = {
      data: {
        bundlerName: "postcss",
      },
      contentType: "text/css",
      content: cssBundleInfos[cssUrlInfo.url].bundleContent,
    };
  });
  return bundledCssUrlInfos;
};

const performCssBundling = async (cssEntryUrlInfos) => {
  const cssBundleInfos = await loadCssUrls(cssEntryUrlInfos);
  const cssUrlsSorted = sortByDependencies(cssBundleInfos);
  cssUrlsSorted.forEach((cssUrl) => {
    const cssBundleInfo = cssBundleInfos[cssUrl];
    const magicSource = createMagicSource(cssBundleInfo.content);
    cssBundleInfo.cssUrls.forEach((cssUrl) => {
      if (cssUrl.type === "@import") {
        magicSource.replace({
          start: cssUrl.atRuleStart,
          end: cssUrl.atRuleEnd,
          replacement: cssBundleInfos[cssUrl.url].bundleContent,
        });
      }
    });
    const { content } = magicSource.toContentAndSourcemap();
    cssBundleInfo.bundleContent = content.trim();
  });
  return cssBundleInfos;
};

const parseCssUrls = async ({ css, url }) => {
  const cssUrls = [];
  await applyPostCss({
    sourcemaps: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({
          type,
          specifier,
          specifierStart,
          specifierEnd,
          atRuleStart,
          atRuleEnd,
        }) => {
          cssUrls.push({
            type,
            url: new URL(specifier, url).href,
            specifierStart,
            specifierEnd,
            atRuleStart,
            atRuleEnd,
          });
        },
      }),
    ],
    url,
    content: css,
  });

  return cssUrls;
};

const loadCssUrls = async (cssEntryUrlInfos) => {
  const firstCssUrlInfo = cssEntryUrlInfos[0];
  const cssBundleInfos = {};
  const promises = [];
  const promiseMap = new Map();

  const load = (cssUrlInfo) => {
    const promiseFromData = promiseMap.get(cssUrlInfo.url);
    if (promiseFromData) return promiseFromData;
    const promise = _load(cssUrlInfo);
    promises.push(promise);
    promiseMap.set(cssUrlInfo.url, promise);
    return promise;
  };

  const _load = async (cssUrlInfo) => {
    const cssUrls = await parseCssUrls({
      css: cssUrlInfo.content,
      url: cssUrlInfo.url,
    });
    const cssBundleInfo = {
      content: cssUrlInfo.content,
      cssUrls,
      referenceToOthersSet: new Set(),
    };
    cssBundleInfos[cssUrlInfo.url] = cssBundleInfo;
    cssUrls.forEach((cssUrl) => {
      if (cssUrl.type === "@import") {
        cssBundleInfo.referenceToOthersSet.add({
          url: cssUrl.url,
        });
        const importedCssUrlInfo = firstCssUrlInfo.graph.getUrlInfo(cssUrl.url);
        load(importedCssUrlInfo);
      }
    });
  };

  cssEntryUrlInfos.forEach((cssEntryUrlInfo) => {
    load(cssEntryUrlInfo);
  });

  const waitAll = async () => {
    if (promises.length === 0) {
      return;
    }
    const promisesToWait = promises.slice();
    promises.length = 0;
    await Promise.all(promisesToWait);
    await waitAll();
  };
  await waitAll();
  promiseMap.clear();

  return cssBundleInfos;
};
