window.__supervisor__.jsClassicStart(document.currentScript.src);
try {
  console.log(10);
  window.__supervisor__.jsClassicEnd(document.currentScript.src);
} catch (e) {
  window.__supervisor__.jsClassicError(document.currentScript.src, e);
}