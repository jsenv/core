export const createIsInsideFragment = (fragment, total) => {
  let [dividend, divisor] = fragment.split("/");
  dividend = parseInt(dividend);
  divisor = parseInt(divisor);
  const groupSize = Math.ceil(total / divisor);
  let from;
  let to;
  if (groupSize === 0) {
    if (dividend === 1) {
      from = 0;
      to = 0;
    } else {
      from = Infinity;
      to = -1;
    }
  } else if (dividend === 1) {
    from = 0;
    to = groupSize;
  } else {
    from = (dividend - 1) * groupSize;
    if (dividend === divisor) {
      to = total;
    } else {
      to = from + groupSize;
    }
  }
  return (index) => {
    if (index < from) return false;
    if (index >= to) return false;
    return true;
  };
};
