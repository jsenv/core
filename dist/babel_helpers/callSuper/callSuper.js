/* @minVersion 7.23.8 */

// This is duplicated to packages/babel-plugin-transform-classes/src/inline-callSuper-helpers.ts

// @ts-expect-error helper
import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js";
import isNativeReflectConstruct from "../isNativeReflectConstruct/isNativeReflectConstruct.js";
// @ts-expect-error helper
import possibleConstructorReturn from "../possibleConstructorReturn/possibleConstructorReturn.js";

export default function _callSuper(_this, derived, args) {
  // Super
  derived = getPrototypeOf(derived);
  return possibleConstructorReturn(
    _this,
    isNativeReflectConstruct()
      ? // NOTE: This doesn't work if this.__proto__.constructor has been modified.
        Reflect.construct(
          derived,
          args || [],
          getPrototypeOf(_this).constructor,
        )
      : derived.apply(_this, args),
  );
}
