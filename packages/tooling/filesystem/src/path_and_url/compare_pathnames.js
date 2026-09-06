/*
 * Which of two pathnames comes first: directories before what is under them,
 * deeper before shallower, then the names themselves.
 *
 * How a leading number reads is the caller's call, because the two readings are
 * both right somewhere:
 * - numeric (the default), where the number is a quantity: "9_x" then "10_x" —
 *   what a generated list wants, so a story numbered by hand stays in the order
 *   it happens;
 * - { numeric: false }, where the number is part of the name: "10_x" right
 *   after "1_x" — the order the filesystem itself gives, and the one every file
 *   explorer above it shows, so a human reading a directory finds it in the
 *   order their editor already shows.
 */
export const comparePathnames = (
  leftPathame,
  rightPathname,
  { numeric = true } = {},
) => {
  const leftPartArray = leftPathame.split("/");
  const rightPartArray = rightPathname.split("/");

  const leftLength = leftPartArray.length;
  const rightLength = rightPartArray.length;

  const maxLength = Math.max(leftLength, rightLength);
  let i = 0;
  while (i < maxLength) {
    const leftPartExists = i in leftPartArray;
    const rightPartExists = i in rightPartArray;

    // longer comes first
    if (!leftPartExists) {
      return +1;
    }
    if (!rightPartExists) {
      return -1;
    }

    const leftPartIsLast = i === leftPartArray.length - 1;
    const rightPartIsLast = i === rightPartArray.length - 1;
    // folder comes first
    if (leftPartIsLast && !rightPartIsLast) {
      return +1;
    }
    if (!leftPartIsLast && rightPartIsLast) {
      return -1;
    }

    const leftPart = leftPartArray[i];
    const rightPart = rightPartArray[i];
    i++;
    // local comparison comes first
    const comparison = leftPart.localeCompare(rightPart, undefined, {
      numeric,
      sensitivity: "base",
    });
    if (comparison !== 0) {
      return comparison;
    }
  }

  if (leftLength < rightLength) {
    return +1;
  }
  if (leftLength > rightLength) {
    return -1;
  }
  return 0;
};
