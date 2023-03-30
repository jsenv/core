window.reportJsClassicStart(import.meta.url);
try {
  console.log(10);
  window.reportJsClassicEnd(import.meta.url);
} catch (e) {
  window.reportJsClassicError(import.meta.url, e);
}