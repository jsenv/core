import OverloadYield from "../overloadYield/overloadYield.js";
export default function _awaitAsyncGenerator(value) {
  return new OverloadYield(value, /* kind: await */0);
}