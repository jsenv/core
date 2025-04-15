import { applyBabelPlugins } from "@jsenv/ast";

export const stripJsComments = async (urlInfo) => {
  const result = await applyBabelPlugins({
    input: urlInfo.content,
    inputUrl: urlInfo.url,
    inputIsJsModule: urlInfo.type === "js_module",
    options: {
      generatorOpts: {
        comments: false,
      },
    },
  });
  const { ast, code, map } = result;
  return {
    content: code,
    sourcemap: map,
    contentAst: ast,
  };
};
