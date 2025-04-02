export const startMonitoringMetric = (measure) => {
  const metrics = [];
  const takeMeasure = () => {
    const value = measure();
    metrics.push(value);
    return value;
  };

  const info = {
    start: takeMeasure(),
    min: null,
    max: null,
    median: null,
    end: null,
  };
  return {
    info,
    measure: takeMeasure,
    end: () => {
      info.end = takeMeasure();
      metrics.sort((a, b) => a - b);
      info.min = metrics[0];
      info.max = metrics[metrics.length - 1];
      info.median = medianFromSortedArray(metrics);
      metrics.length = 0;
    },
  };
};

export const medianFromSortedArray = (array) => {
  const length = array.length;
  const isOdd = length % 2 === 1;
  if (isOdd) {
    const medianNumberIndex = (length - 1) / 2;
    const medianNumber = array[medianNumberIndex];
    return medianNumber;
  }
  const rightMiddleNumberIndex = length / 2;
  const leftMiddleNumberIndex = rightMiddleNumberIndex - 1;
  const leftMiddleNumber = array[leftMiddleNumberIndex];
  const rightMiddleNumber = array[rightMiddleNumberIndex];
  const medianNumber = (leftMiddleNumber + rightMiddleNumber) / 2;
  return medianNumber;
};
