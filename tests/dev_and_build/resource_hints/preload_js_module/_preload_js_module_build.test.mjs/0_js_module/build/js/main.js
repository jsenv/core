console.log(globalThis);

import(__v__("/js/dep.js"));


await new Promise((resolve) => {
  setTimeout(resolve, 3_000);
});
window.resolveResultPromise(42);