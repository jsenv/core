window.reportJsClassicStart(document.currentScript.src);
try {
  console.log(10);
  window.reportJsClassicEnd(document.currentScript.src);
} catch (e) {
  window.reportJsClassicError(document.currentScript.src, e);
}