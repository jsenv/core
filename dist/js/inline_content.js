/* eslint-env browser,node */

const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, {
  type = "text/plain"
}) {
  this.text = content;
  this.type = type;
};
