import { answer } from "./dep.js";

// eslint-disable-next-line no-undef
window.ask = () => answer;

const [value] = [answer];
console.log({
  ...{ value },
});
