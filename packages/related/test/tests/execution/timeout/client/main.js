console.log("foo");
await new Promise((resolve) => {
  setTimeout(resolve, 30_000);
});
