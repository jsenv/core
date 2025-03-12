const logA = async () => {
  const { a } = await import("./js/a.js");
  console.log(a);
};

const logB = async () => {
  const { b } = await import("./js/b.js");

  console.log(b);
};

export { logA, logB };
