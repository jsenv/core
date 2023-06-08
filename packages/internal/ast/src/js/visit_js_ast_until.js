import { simple } from "acorn-walk";

const stop = {};

export const visitJsAstUntil = (ast, visitors) => {
  const visitorsMapped = {};
  let returnValue = null;
  Object.keys(visitors).forEach((key) => {
    visitorsMapped[key] = (node, ...args) => {
      const visitorReturnValue = visitors[key](...args);
      if (visitorReturnValue === true) {
        returnValue = node;
        throw stop;
      }
      if (typeof visitorReturnValue === "object" && returnValue !== null) {
        returnValue = visitorReturnValue;
        throw stop;
      }
    };
  });
  try {
    simple(ast, visitorsMapped);
    return returnValue;
  } catch (e) {
    if (e === stop) {
      return returnValue;
    }
    throw e;
  }
};
