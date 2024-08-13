/**
 *
 * https://jonlabelle.com/snippets/view/javascript/calculate-mean-median-mode-and-range-in-javascript
 * https://www.sitepoint.com/measuring-javascript-functions-performance/#pitfall-3-relying-too-much-on-the-average
 *
 * median of [3, 5, 4, 4, 1, 1, 2, 3] = 3
 *
 */

export const median = (numbers) => {
  const numberCount = numbers.length;
  const numbersSorted = numbers.slice();
  numbersSorted.sort();

  const isEven = numberCount % 2 === 0;
  if (isEven) {
    const rightMiddleNumberIndex = numberCount / 2;
    const leftMiddleNumberIndex = rightMiddleNumberIndex - 1;
    const leftMiddleNumber = numbersSorted[leftMiddleNumberIndex];
    const rightMiddleNumber = numbersSorted[rightMiddleNumberIndex];
    const medianNumber = (leftMiddleNumber + rightMiddleNumber) / 2;
    return medianNumber;
  }

  const medianNumberIndex = (numberCount - 1) / 2;
  const medianNumber = numbersSorted[medianNumberIndex];
  return medianNumber;
};
