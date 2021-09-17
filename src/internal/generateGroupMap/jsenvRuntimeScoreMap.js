// https://www.statista.com/statistics/268299/most-popular-internet-browsers/
// this source of stat is what I found in 5min
// we could improve these default usage score using better stats
// and keep in mind this should be updated time to time or even better
// come from a project specific audience

export const jsenvBrowserScoreMap = {
  android: 0.001,
  chrome: {
    71: 0.3,
    69: 0.19,
    0: 0.01, // it means oldest version of chrome will get a score of 0.01
  },
  firefox: {
    61: 0.3,
  },
  edge: {
    12: 0.1,
  },
  electron: 0.001,
  ios: 0.001,
  opera: 0.001,
  other: 0.001,
  safari: {
    10: 0.1,
  },
}

// https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
export const jsenvNodeVersionScoreMap = {
  "0.10": 0.02,
  "0.12": 0.01,
  "4": 0.1,
  "6": 0.25,
  "7": 0.1,
  "8": 1,
  "9": 0.1,
  "10": 0.5,
  "11": 0.25,
}

export const jsenvRuntimeScoreMap = {
  ...jsenvBrowserScoreMap,
  node: jsenvNodeVersionScoreMap,
}
