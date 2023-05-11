const typeofCurrentScript = typeof document.currentScript;

/*
 * using spread + destructuring generate a dependency to babel helpers
 * making the code execute async and fails the test
 * How to fix:
 * 1. do not use anything requiring babel helpers (painful and hard to predict)
 * 2. put babel helpers on window/self instead of separate file to share them without having to load a js
 * (that would be great but it's hard to make it work right now)
 * 3. inline babel helpers when using ?js_module_fallback (or at least be able to force inline them)
 * in this scenario
 *
 * SOLUTION FOR NOW: 3
 */

const getResponse = () => {
  return [42];
};
const [answer] = getResponse();
console.log({
  ...{ answer },
});

window.getResult = async () => {
  const { answer } = await import("./file.js");
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  const url = import.meta.url;
  return {
    typeofCurrentScript,
    answer,
    url,
  };
};
