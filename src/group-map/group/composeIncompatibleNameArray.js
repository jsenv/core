import { arrayWithoutDuplicate } from "/node_modules/@dmail/helper/index.js"

export const composeIncompatibleNameArray = (prevNameArray, nameArray) =>
  arrayWithoutDuplicate([...prevNameArray, ...nameArray]).sort()
