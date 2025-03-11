import { b } from "./js/vendors.js";

const doSomething = async () => {
  const { a } = await import("./js/index.js");
  console.log(a);
};

const logB = () => {
  console.log(b);
};

export { doSomething, logB };
