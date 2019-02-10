// https://www.statista.com/statistics/268299/most-popular-internet-browsers/

export const platformUsageMapDefault = {
  chrome: {
    "71": 0.3,
    "69": 0.19,
    "0": 0.01, // it means oldest version of chrome will get a score of 0.01
  },
  firefox: {
    "61": 0.3,
  },
  edge: {
    "12": 0.1,
    "0": 0.001,
  },
  safari: {
    "10": 0.1,
    "0": 0.001,
  },
  node: {
    "8": 0.5,
    "0": 0.001,
  },
  other: 0.001,
}
