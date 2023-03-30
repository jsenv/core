import "./a.js";
window.reportJsModuleExecution((async () => {
  await 42;
})());