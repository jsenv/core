export const composeIncompatibleNameArray = (prevNameArray, nameArray) =>
  arrayWithoutDuplicate([...prevNameArray, ...nameArray]).sort()

const arrayWithoutDuplicate = (array) =>
  array.filter((value, index) => array.indexOf(value) === index)
