import arrayLikeToArray from "../arrayLikeToArray/arrayLikeToArray.js"

// eslint-disable-next-line consistent-return
export default (arr) => {
  if (Array.isArray(arr)) return arrayLikeToArray(arr)
}
