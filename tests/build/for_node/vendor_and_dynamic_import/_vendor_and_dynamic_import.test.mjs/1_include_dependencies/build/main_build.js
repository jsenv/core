const logA = async () => {
  const { a } = await import("./a/a.js");
  console.log(a);
};

const logB = async () => {
  const { b } = await import("./b/b.js");

  console.log(b);
};

export { logA, logB };
