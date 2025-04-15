import "/test_node_modules.js";

const test = async () => {
  await Promise.resolve().then(() => main);
};

const main =              Object.freeze(             Object.defineProperty({
  __proto__: null
}, Symbol.toStringTag, { value: 'Module' }));

export { test };