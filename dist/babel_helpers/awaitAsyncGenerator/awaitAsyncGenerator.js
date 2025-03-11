import OverloadYield from "../OverloadYield/OverloadYield.js";

export default function _awaitAsyncGenerator(value) {
  return new OverloadYield(value, /* kind: await */ 0);
}
