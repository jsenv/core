import { simple } from "acorn-walk";

export const visitJsAst = (ast, visitors) => {
  simple(ast, visitors);
};
