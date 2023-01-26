System.register([], function (_export, _context) {
  "use strict";

  function InlineContent(content, {
    type = "text/plain"
  }) {
    this.text = content;
    this.type = type;
  }
  _export("InlineContent", InlineContent);
  return {
    setters: [],
    execute: function () {}
  };
});