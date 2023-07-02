import { applyCssTranspilation } from "./apply_css_transpilation.js";

export const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: (urlInfo) => {
        return applyCssTranspilation({
          input: urlInfo.content,
          inputUrl: urlInfo.originalUrl,
          runtimeCompat: urlInfo.context.runtimeCompat,
        });
      },
    },
  };
};
