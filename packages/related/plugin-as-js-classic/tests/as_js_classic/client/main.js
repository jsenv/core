import { answer } from "./dep.js";

window.ask = () => answer;

const [value] = [answer];
console.log({
  ...{ value },
});
