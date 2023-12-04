console.log("foo");
await new Promise((resolve) => {
  setTimeout(resolve, 2_000);
});
