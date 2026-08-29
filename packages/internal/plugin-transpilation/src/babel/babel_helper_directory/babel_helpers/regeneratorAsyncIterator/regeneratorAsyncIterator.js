import OverloadYield from "../OverloadYield/OverloadYield.js";
import regeneratorDefine from "../regeneratorDefine/regeneratorDefine.js";

/* eslint-disable */
export default function AsyncIterator(generator, PromiseImpl) {
  if (!this.next) {
    regeneratorDefine(AsyncIterator.prototype);
    regeneratorDefine(AsyncIterator.prototype, typeof Symbol === "function" && Symbol.asyncIterator || "@asyncIterator", function () {
      return this;
    });
  }
  function invoke(method, arg, resolve, reject) {
    try {
      var result = generator[method](arg);
      var value = result.value;
      if (value instanceof OverloadYield) {
        return PromiseImpl.resolve(value.v).then(function (value) {
          invoke("next", value, resolve, reject);
        }, function (err) {
          invoke("throw", err, resolve, reject);
        });
      }
      return PromiseImpl.resolve(value).then(function (unwrapped) {
        result.value = unwrapped;
        resolve(result);
      }, function (error) {
        return invoke("throw", error, resolve, reject);
      });
    } catch (error) {
      reject(error);
    }
  }
  var previousPromise;
  function enqueue(method, i, arg) {
    function callInvokeWithMethodAndArg() {
      return new PromiseImpl(function (resolve, reject) {
        invoke(method, arg, resolve, reject);
      });
    }
    return previousPromise = previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
  }
  regeneratorDefine(this, "_invoke", enqueue, true);
}
