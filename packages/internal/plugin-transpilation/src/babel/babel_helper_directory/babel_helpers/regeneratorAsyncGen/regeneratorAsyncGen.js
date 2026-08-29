import regenerator from "../regenerator/regenerator.js";
import regeneratorAsyncIterator from "../regeneratorAsyncIterator/regeneratorAsyncIterator.js";

/* eslint-disable */
export default function _regeneratorAsyncGen(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
  return new regeneratorAsyncIterator(regenerator().w(innerFn, outerFn, self, tryLocsList), PromiseImpl || Promise);
}
