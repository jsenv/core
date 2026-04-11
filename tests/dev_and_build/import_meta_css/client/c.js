export const setBodyFontSize = (size) => {
  import.meta.css = /* css */ `
    body {
      font-size: ${size};
    }
  `;
};

// Called at module evaluation time so that installImportMetaCssBuild runs for
// c.js before a.js and b.js are imported. This lets us verify that subsequent
// installImportMetaCssBuild calls (from a.js and b.js) are idempotent and do
// not reset the stylesheet state already established by c.js.
setBodyFontSize("16px");
