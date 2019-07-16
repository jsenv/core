import { arrayWithoutDuplicate } from "@dmail/helper"

export const composeIncompatibleNameArray = (prevNameArray, nameArray) =>
  arrayWithoutDuplicate([...prevNameArray, ...nameArray]).sort()
