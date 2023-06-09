/* eslint-env browser,node */

/*
 * This file does not use export const InlineContent = function() {} on purpose:
 * - An export would be renamed by rollup,
 *   making it harder to statically detect new InlineContent() calls
 * - An export would be renamed by terser
 *   here again it becomes hard to detect new InlineContent() calls
 * Instead it sets "__InlineContent__" on the global object and terser is configured by jsenv
 * to preserve the __InlineContent__ global variable name
 */

const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};
