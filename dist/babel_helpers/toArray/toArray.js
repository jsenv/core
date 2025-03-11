import arrayWithHoles from "../arrayWithHoles/arrayWithHoles.js";
import iterableToArray from "../iterableToArray/iterableToArray.js";
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js";
import nonIterableRest from "../nonIterableRest/nonIterableRest.js";

export default (arr) =>
  arrayWithHoles(arr) ||
  iterableToArray(arr) ||
  unsupportedIterableToArray(arr) ||
  nonIterableRest();
