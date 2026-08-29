import regeneratorAsyncGen from "../regeneratorAsyncGen/regeneratorAsyncGen.js";

/* eslint-disable */
export default function _regeneratorAsync(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
  var iter = regeneratorAsyncGen(innerFn, outerFn, self, tryLocsList, PromiseImpl);
  return iter.next().then(function (result) {
    return result.done ? result.value : iter.next();
  });
}
