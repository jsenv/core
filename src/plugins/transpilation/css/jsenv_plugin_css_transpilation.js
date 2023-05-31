import { applyCssTranspilation } from "@jsenv/css-transpilation";

export const jsenvPluginCssTranspilation = () => {
  return {
    name: "jsenv:css_transpilation",
    appliesDuring: "*",
    transformUrlContent: {
      css: async (urlInfo, context) => {
        return applyCssTranspilation({
          input: urlInfo.content,
          inputUrl: urlInfo.originalUrl,
          runtimeCompat: context.runtimeCompat,
        });
      },
    },
  };
};
