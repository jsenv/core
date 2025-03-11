// https://github.com/nodejs/node/issues/22088
console.log("foo");
await new Promise((resolve) => {
  const id = setTimeout(resolve, 30_000);
  process.on("SIGTERM", () => {
    clearTimeout(id);
  });
});
