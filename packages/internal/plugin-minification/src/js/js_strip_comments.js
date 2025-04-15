import { applyBabelPlugins } from "@jsenv/ast";

export const stripJsComments = async (urlInfo) => {
  const result = await applyBabelPlugins({
    input: urlInfo.content,
    inputUrl: urlInfo.url,
    inputIsJsModule: urlInfo.type === "js_module",
    options: {
      parserOpts: {
        // needs because of "experimental_preserveFormat"
        tokens: true,
        createParenthesizedExpressions: true,
      },
      generatorOpts: {
        comments: false,
        retainLines: true,
        retainFunctionParens: true,
        experimental_preserveFormat: true, // see "experimental_preserveFormat" in https://babeljs.io/docs/babel-generator#options
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
