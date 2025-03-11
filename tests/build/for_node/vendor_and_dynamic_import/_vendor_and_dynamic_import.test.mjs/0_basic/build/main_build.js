import { b } from "./js/vendors.js";

const doSomething = async () => {
  const { a } = await import("./js/a.js");
  console.log(a);
};

const logB = () => {
  console.log(b);
};

export { doSomething, logB };
