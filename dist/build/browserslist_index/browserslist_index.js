import require$$3$1 from "node:path";
import require$$2 from "node:fs";

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var require$$0 = [
  {
    name: "nodejs",
    version: "0.2.0",
    date: "2011-08-26",
    lts: false,
    security: false,
    v8: "2.3.8.0"
  },
  {
    name: "nodejs",
    version: "0.3.0",
    date: "2011-08-26",
    lts: false,
    security: false,
    v8: "2.5.1.0"
  },
  {
    name: "nodejs",
    version: "0.4.0",
    date: "2011-08-26",
    lts: false,
    security: false,
    v8: "3.1.2.0"
  },
  {
    name: "nodejs",
    version: "0.5.0",
    date: "2011-08-26",
    lts: false,
    security: false,
    v8: "3.1.8.25"
  },
  {
    name: "nodejs",
    version: "0.6.0",
    date: "2011-11-04",
    lts: false,
    security: false,
    v8: "3.6.6.6"
  },
  {
    name: "nodejs",
    version: "0.7.0",
    date: "2012-01-17",
    lts: false,
    security: false,
    v8: "3.8.6.0"
  },
  {
    name: "nodejs",
    version: "0.8.0",
    date: "2012-06-22",
    lts: false,
    security: false,
    v8: "3.11.10.10"
  },
  {
    name: "nodejs",
    version: "0.9.0",
    date: "2012-07-20",
    lts: false,
    security: false,
    v8: "3.11.10.15"
  },
  {
    name: "nodejs",
    version: "0.10.0",
    date: "2013-03-11",
    lts: false,
    security: false,
    v8: "3.14.5.8"
  },
  {
    name: "nodejs",
    version: "0.11.0",
    date: "2013-03-28",
    lts: false,
    security: false,
    v8: "3.17.13.0"
  },
  {
    name: "nodejs",
    version: "0.12.0",
    date: "2015-02-06",
    lts: false,
    security: false,
    v8: "3.28.73.0"
  },
  {
    name: "nodejs",
    version: "4.0.0",
    date: "2015-09-08",
    lts: false,
    security: false,
    v8: "4.5.103.30"
  },
  {
    name: "nodejs",
    version: "4.1.0",
    date: "2015-09-17",
    lts: false,
    security: false,
    v8: "4.5.103.33"
  },
  {
    name: "nodejs",
    version: "4.2.0",
    date: "2015-10-12",
    lts: "Argon",
    security: false,
    v8: "4.5.103.35"
  },
  {
    name: "nodejs",
    version: "4.3.0",
    date: "2016-02-09",
    lts: "Argon",
    security: false,
    v8: "4.5.103.35"
  },
  {
    name: "nodejs",
    version: "4.4.0",
    date: "2016-03-08",
    lts: "Argon",
    security: false,
    v8: "4.5.103.35"
  },
  {
    name: "nodejs",
    version: "4.5.0",
    date: "2016-08-16",
    lts: "Argon",
    security: false,
    v8: "4.5.103.37"
  },
  {
    name: "nodejs",
    version: "4.6.0",
    date: "2016-09-27",
    lts: "Argon",
    security: true,
    v8: "4.5.103.37"
  },
  {
    name: "nodejs",
    version: "4.7.0",
    date: "2016-12-06",
    lts: "Argon",
    security: false,
    v8: "4.5.103.43"
  },
  {
    name: "nodejs",
    version: "4.8.0",
    date: "2017-02-21",
    lts: "Argon",
    security: false,
    v8: "4.5.103.45"
  },
  {
    name: "nodejs",
    version: "4.9.0",
    date: "2018-03-28",
    lts: "Argon",
    security: true,
    v8: "4.5.103.53"
  },
  {
    name: "nodejs",
    version: "5.0.0",
    date: "2015-10-29",
    lts: false,
    security: false,
    v8: "4.6.85.28"
  },
  {
    name: "nodejs",
    version: "5.1.0",
    date: "2015-11-17",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.2.0",
    date: "2015-12-09",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.3.0",
    date: "2015-12-15",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.4.0",
    date: "2016-01-06",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.5.0",
    date: "2016-01-21",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.6.0",
    date: "2016-02-09",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.7.0",
    date: "2016-02-23",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.8.0",
    date: "2016-03-09",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.9.0",
    date: "2016-03-16",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.10.0",
    date: "2016-04-01",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.11.0",
    date: "2016-04-21",
    lts: false,
    security: false,
    v8: "4.6.85.31"
  },
  {
    name: "nodejs",
    version: "5.12.0",
    date: "2016-06-23",
    lts: false,
    security: false,
    v8: "4.6.85.32"
  },
  {
    name: "nodejs",
    version: "6.0.0",
    date: "2016-04-26",
    lts: false,
    security: false,
    v8: "5.0.71.35"
  },
  {
    name: "nodejs",
    version: "6.1.0",
    date: "2016-05-05",
    lts: false,
    security: false,
    v8: "5.0.71.35"
  },
  {
    name: "nodejs",
    version: "6.2.0",
    date: "2016-05-17",
    lts: false,
    security: false,
    v8: "5.0.71.47"
  },
  {
    name: "nodejs",
    version: "6.3.0",
    date: "2016-07-06",
    lts: false,
    security: false,
    v8: "5.0.71.52"
  },
  {
    name: "nodejs",
    version: "6.4.0",
    date: "2016-08-12",
    lts: false,
    security: false,
    v8: "5.0.71.60"
  },
  {
    name: "nodejs",
    version: "6.5.0",
    date: "2016-08-26",
    lts: false,
    security: false,
    v8: "5.1.281.81"
  },
  {
    name: "nodejs",
    version: "6.6.0",
    date: "2016-09-14",
    lts: false,
    security: false,
    v8: "5.1.281.83"
  },
  {
    name: "nodejs",
    version: "6.7.0",
    date: "2016-09-27",
    lts: false,
    security: true,
    v8: "5.1.281.83"
  },
  {
    name: "nodejs",
    version: "6.8.0",
    date: "2016-10-12",
    lts: false,
    security: false,
    v8: "5.1.281.84"
  },
  {
    name: "nodejs",
    version: "6.9.0",
    date: "2016-10-18",
    lts: "Boron",
    security: false,
    v8: "5.1.281.84"
  },
  {
    name: "nodejs",
    version: "6.10.0",
    date: "2017-02-21",
    lts: "Boron",
    security: false,
    v8: "5.1.281.93"
  },
  {
    name: "nodejs",
    version: "6.11.0",
    date: "2017-06-06",
    lts: "Boron",
    security: false,
    v8: "5.1.281.102"
  },
  {
    name: "nodejs",
    version: "6.12.0",
    date: "2017-11-06",
    lts: "Boron",
    security: false,
    v8: "5.1.281.108"
  },
  {
    name: "nodejs",
    version: "6.13.0",
    date: "2018-02-10",
    lts: "Boron",
    security: false,
    v8: "5.1.281.111"
  },
  {
    name: "nodejs",
    version: "6.14.0",
    date: "2018-03-28",
    lts: "Boron",
    security: true,
    v8: "5.1.281.111"
  },
  {
    name: "nodejs",
    version: "6.15.0",
    date: "2018-11-27",
    lts: "Boron",
    security: true,
    v8: "5.1.281.111"
  },
  {
    name: "nodejs",
    version: "6.16.0",
    date: "2018-12-26",
    lts: "Boron",
    security: false,
    v8: "5.1.281.111"
  },
  {
    name: "nodejs",
    version: "6.17.0",
    date: "2019-02-28",
    lts: "Boron",
    security: true,
    v8: "5.1.281.111"
  },
  {
    name: "nodejs",
    version: "7.0.0",
    date: "2016-10-25",
    lts: false,
    security: false,
    v8: "5.4.500.36"
  },
  {
    name: "nodejs",
    version: "7.1.0",
    date: "2016-11-08",
    lts: false,
    security: false,
    v8: "5.4.500.36"
  },
  {
    name: "nodejs",
    version: "7.2.0",
    date: "2016-11-22",
    lts: false,
    security: false,
    v8: "5.4.500.43"
  },
  {
    name: "nodejs",
    version: "7.3.0",
    date: "2016-12-20",
    lts: false,
    security: false,
    v8: "5.4.500.45"
  },
  {
    name: "nodejs",
    version: "7.4.0",
    date: "2017-01-04",
    lts: false,
    security: false,
    v8: "5.4.500.45"
  },
  {
    name: "nodejs",
    version: "7.5.0",
    date: "2017-01-31",
    lts: false,
    security: false,
    v8: "5.4.500.48"
  },
  {
    name: "nodejs",
    version: "7.6.0",
    date: "2017-02-21",
    lts: false,
    security: false,
    v8: "5.5.372.40"
  },
  {
    name: "nodejs",
    version: "7.7.0",
    date: "2017-02-28",
    lts: false,
    security: false,
    v8: "5.5.372.41"
  },
  {
    name: "nodejs",
    version: "7.8.0",
    date: "2017-03-29",
    lts: false,
    security: false,
    v8: "5.5.372.43"
  },
  {
    name: "nodejs",
    version: "7.9.0",
    date: "2017-04-11",
    lts: false,
    security: false,
    v8: "5.5.372.43"
  },
  {
    name: "nodejs",
    version: "7.10.0",
    date: "2017-05-02",
    lts: false,
    security: false,
    v8: "5.5.372.43"
  },
  {
    name: "nodejs",
    version: "8.0.0",
    date: "2017-05-30",
    lts: false,
    security: false,
    v8: "5.8.283.41"
  },
  {
    name: "nodejs",
    version: "8.1.0",
    date: "2017-06-08",
    lts: false,
    security: false,
    v8: "5.8.283.41"
  },
  {
    name: "nodejs",
    version: "8.2.0",
    date: "2017-07-19",
    lts: false,
    security: false,
    v8: "5.8.283.41"
  },
  {
    name: "nodejs",
    version: "8.3.0",
    date: "2017-08-08",
    lts: false,
    security: false,
    v8: "6.0.286.52"
  },
  {
    name: "nodejs",
    version: "8.4.0",
    date: "2017-08-15",
    lts: false,
    security: false,
    v8: "6.0.286.52"
  },
  {
    name: "nodejs",
    version: "8.5.0",
    date: "2017-09-12",
    lts: false,
    security: false,
    v8: "6.0.287.53"
  },
  {
    name: "nodejs",
    version: "8.6.0",
    date: "2017-09-26",
    lts: false,
    security: false,
    v8: "6.0.287.53"
  },
  {
    name: "nodejs",
    version: "8.7.0",
    date: "2017-10-11",
    lts: false,
    security: false,
    v8: "6.1.534.42"
  },
  {
    name: "nodejs",
    version: "8.8.0",
    date: "2017-10-24",
    lts: false,
    security: false,
    v8: "6.1.534.42"
  },
  {
    name: "nodejs",
    version: "8.9.0",
    date: "2017-10-31",
    lts: "Carbon",
    security: false,
    v8: "6.1.534.46"
  },
  {
    name: "nodejs",
    version: "8.10.0",
    date: "2018-03-06",
    lts: "Carbon",
    security: false,
    v8: "6.2.414.50"
  },
  {
    name: "nodejs",
    version: "8.11.0",
    date: "2018-03-28",
    lts: "Carbon",
    security: true,
    v8: "6.2.414.50"
  },
  {
    name: "nodejs",
    version: "8.12.0",
    date: "2018-09-10",
    lts: "Carbon",
    security: false,
    v8: "6.2.414.66"
  },
  {
    name: "nodejs",
    version: "8.13.0",
    date: "2018-11-20",
    lts: "Carbon",
    security: false,
    v8: "6.2.414.72"
  },
  {
    name: "nodejs",
    version: "8.14.0",
    date: "2018-11-27",
    lts: "Carbon",
    security: true,
    v8: "6.2.414.72"
  },
  {
    name: "nodejs",
    version: "8.15.0",
    date: "2018-12-26",
    lts: "Carbon",
    security: false,
    v8: "6.2.414.75"
  },
  {
    name: "nodejs",
    version: "8.16.0",
    date: "2019-04-16",
    lts: "Carbon",
    security: false,
    v8: "6.2.414.77"
  },
  {
    name: "nodejs",
    version: "8.17.0",
    date: "2019-12-17",
    lts: "Carbon",
    security: true,
    v8: "6.2.414.78"
  },
  {
    name: "nodejs",
    version: "9.0.0",
    date: "2017-10-31",
    lts: false,
    security: false,
    v8: "6.2.414.32"
  },
  {
    name: "nodejs",
    version: "9.1.0",
    date: "2017-11-07",
    lts: false,
    security: false,
    v8: "6.2.414.32"
  },
  {
    name: "nodejs",
    version: "9.2.0",
    date: "2017-11-14",
    lts: false,
    security: false,
    v8: "6.2.414.44"
  },
  {
    name: "nodejs",
    version: "9.3.0",
    date: "2017-12-12",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.4.0",
    date: "2018-01-10",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.5.0",
    date: "2018-01-31",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.6.0",
    date: "2018-02-21",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.7.0",
    date: "2018-03-01",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.8.0",
    date: "2018-03-07",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.9.0",
    date: "2018-03-21",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.10.0",
    date: "2018-03-28",
    lts: false,
    security: true,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "9.11.0",
    date: "2018-04-04",
    lts: false,
    security: false,
    v8: "6.2.414.46"
  },
  {
    name: "nodejs",
    version: "10.0.0",
    date: "2018-04-24",
    lts: false,
    security: false,
    v8: "6.6.346.24"
  },
  {
    name: "nodejs",
    version: "10.1.0",
    date: "2018-05-08",
    lts: false,
    security: false,
    v8: "6.6.346.27"
  },
  {
    name: "nodejs",
    version: "10.2.0",
    date: "2018-05-23",
    lts: false,
    security: false,
    v8: "6.6.346.32"
  },
  {
    name: "nodejs",
    version: "10.3.0",
    date: "2018-05-29",
    lts: false,
    security: false,
    v8: "6.6.346.32"
  },
  {
    name: "nodejs",
    version: "10.4.0",
    date: "2018-06-06",
    lts: false,
    security: false,
    v8: "6.7.288.43"
  },
  {
    name: "nodejs",
    version: "10.5.0",
    date: "2018-06-20",
    lts: false,
    security: false,
    v8: "6.7.288.46"
  },
  {
    name: "nodejs",
    version: "10.6.0",
    date: "2018-07-04",
    lts: false,
    security: false,
    v8: "6.7.288.46"
  },
  {
    name: "nodejs",
    version: "10.7.0",
    date: "2018-07-18",
    lts: false,
    security: false,
    v8: "6.7.288.49"
  },
  {
    name: "nodejs",
    version: "10.8.0",
    date: "2018-08-01",
    lts: false,
    security: false,
    v8: "6.7.288.49"
  },
  {
    name: "nodejs",
    version: "10.9.0",
    date: "2018-08-15",
    lts: false,
    security: false,
    v8: "6.8.275.24"
  },
  {
    name: "nodejs",
    version: "10.10.0",
    date: "2018-09-06",
    lts: false,
    security: false,
    v8: "6.8.275.30"
  },
  {
    name: "nodejs",
    version: "10.11.0",
    date: "2018-09-19",
    lts: false,
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.12.0",
    date: "2018-10-10",
    lts: false,
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.13.0",
    date: "2018-10-30",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.14.0",
    date: "2018-11-27",
    lts: "Dubnium",
    security: true,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.15.0",
    date: "2018-12-26",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.16.0",
    date: "2019-05-28",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.17.0",
    date: "2019-10-22",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.18.0",
    date: "2019-12-17",
    lts: "Dubnium",
    security: true,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.19.0",
    date: "2020-02-05",
    lts: "Dubnium",
    security: true,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.20.0",
    date: "2020-03-26",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.21.0",
    date: "2020-06-02",
    lts: "Dubnium",
    security: true,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.22.0",
    date: "2020-07-21",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.23.0",
    date: "2020-10-27",
    lts: "Dubnium",
    security: false,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "10.24.0",
    date: "2021-02-23",
    lts: "Dubnium",
    security: true,
    v8: "6.8.275.32"
  },
  {
    name: "nodejs",
    version: "11.0.0",
    date: "2018-10-23",
    lts: false,
    security: false,
    v8: "7.0.276.28"
  },
  {
    name: "nodejs",
    version: "11.1.0",
    date: "2018-10-30",
    lts: false,
    security: false,
    v8: "7.0.276.32"
  },
  {
    name: "nodejs",
    version: "11.2.0",
    date: "2018-11-15",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.3.0",
    date: "2018-11-27",
    lts: false,
    security: true,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.4.0",
    date: "2018-12-07",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.5.0",
    date: "2018-12-18",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.6.0",
    date: "2018-12-26",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.7.0",
    date: "2019-01-17",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.8.0",
    date: "2019-01-24",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.9.0",
    date: "2019-01-30",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.10.0",
    date: "2019-02-14",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.11.0",
    date: "2019-03-05",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.12.0",
    date: "2019-03-14",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.13.0",
    date: "2019-03-28",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.14.0",
    date: "2019-04-10",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "11.15.0",
    date: "2019-04-30",
    lts: false,
    security: false,
    v8: "7.0.276.38"
  },
  {
    name: "nodejs",
    version: "12.0.0",
    date: "2019-04-23",
    lts: false,
    security: false,
    v8: "7.4.288.21"
  },
  {
    name: "nodejs",
    version: "12.1.0",
    date: "2019-04-29",
    lts: false,
    security: false,
    v8: "7.4.288.21"
  },
  {
    name: "nodejs",
    version: "12.2.0",
    date: "2019-05-07",
    lts: false,
    security: false,
    v8: "7.4.288.21"
  },
  {
    name: "nodejs",
    version: "12.3.0",
    date: "2019-05-21",
    lts: false,
    security: false,
    v8: "7.4.288.27"
  },
  {
    name: "nodejs",
    version: "12.4.0",
    date: "2019-06-04",
    lts: false,
    security: false,
    v8: "7.4.288.27"
  },
  {
    name: "nodejs",
    version: "12.5.0",
    date: "2019-06-26",
    lts: false,
    security: false,
    v8: "7.5.288.22"
  },
  {
    name: "nodejs",
    version: "12.6.0",
    date: "2019-07-03",
    lts: false,
    security: false,
    v8: "7.5.288.22"
  },
  {
    name: "nodejs",
    version: "12.7.0",
    date: "2019-07-23",
    lts: false,
    security: false,
    v8: "7.5.288.22"
  },
  {
    name: "nodejs",
    version: "12.8.0",
    date: "2019-08-06",
    lts: false,
    security: false,
    v8: "7.5.288.22"
  },
  {
    name: "nodejs",
    version: "12.9.0",
    date: "2019-08-20",
    lts: false,
    security: false,
    v8: "7.6.303.29"
  },
  {
    name: "nodejs",
    version: "12.10.0",
    date: "2019-09-04",
    lts: false,
    security: false,
    v8: "7.6.303.29"
  },
  {
    name: "nodejs",
    version: "12.11.0",
    date: "2019-09-25",
    lts: false,
    security: false,
    v8: "7.7.299.11"
  },
  {
    name: "nodejs",
    version: "12.12.0",
    date: "2019-10-11",
    lts: false,
    security: false,
    v8: "7.7.299.13"
  },
  {
    name: "nodejs",
    version: "12.13.0",
    date: "2019-10-21",
    lts: "Erbium",
    security: false,
    v8: "7.7.299.13"
  },
  {
    name: "nodejs",
    version: "12.14.0",
    date: "2019-12-17",
    lts: "Erbium",
    security: true,
    v8: "7.7.299.13"
  },
  {
    name: "nodejs",
    version: "12.15.0",
    date: "2020-02-05",
    lts: "Erbium",
    security: true,
    v8: "7.7.299.13"
  },
  {
    name: "nodejs",
    version: "12.16.0",
    date: "2020-02-11",
    lts: "Erbium",
    security: false,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.17.0",
    date: "2020-05-26",
    lts: "Erbium",
    security: false,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.18.0",
    date: "2020-06-02",
    lts: "Erbium",
    security: true,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.19.0",
    date: "2020-10-06",
    lts: "Erbium",
    security: false,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.20.0",
    date: "2020-11-24",
    lts: "Erbium",
    security: false,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.21.0",
    date: "2021-02-23",
    lts: "Erbium",
    security: true,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "12.22.0",
    date: "2021-03-30",
    lts: "Erbium",
    security: false,
    v8: "7.8.279.23"
  },
  {
    name: "nodejs",
    version: "13.0.0",
    date: "2019-10-22",
    lts: false,
    security: false,
    v8: "7.8.279.17"
  },
  {
    name: "nodejs",
    version: "13.1.0",
    date: "2019-11-05",
    lts: false,
    security: false,
    v8: "7.8.279.17"
  },
  {
    name: "nodejs",
    version: "13.2.0",
    date: "2019-11-21",
    lts: false,
    security: false,
    v8: "7.9.317.23"
  },
  {
    name: "nodejs",
    version: "13.3.0",
    date: "2019-12-03",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.4.0",
    date: "2019-12-17",
    lts: false,
    security: true,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.5.0",
    date: "2019-12-18",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.6.0",
    date: "2020-01-07",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.7.0",
    date: "2020-01-21",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.8.0",
    date: "2020-02-05",
    lts: false,
    security: true,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.9.0",
    date: "2020-02-18",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.10.0",
    date: "2020-03-04",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.11.0",
    date: "2020-03-12",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.12.0",
    date: "2020-03-26",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.13.0",
    date: "2020-04-14",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "13.14.0",
    date: "2020-04-29",
    lts: false,
    security: false,
    v8: "7.9.317.25"
  },
  {
    name: "nodejs",
    version: "14.0.0",
    date: "2020-04-21",
    lts: false,
    security: false,
    v8: "8.1.307.30"
  },
  {
    name: "nodejs",
    version: "14.1.0",
    date: "2020-04-29",
    lts: false,
    security: false,
    v8: "8.1.307.31"
  },
  {
    name: "nodejs",
    version: "14.2.0",
    date: "2020-05-05",
    lts: false,
    security: false,
    v8: "8.1.307.31"
  },
  {
    name: "nodejs",
    version: "14.3.0",
    date: "2020-05-19",
    lts: false,
    security: false,
    v8: "8.1.307.31"
  },
  {
    name: "nodejs",
    version: "14.4.0",
    date: "2020-06-02",
    lts: false,
    security: true,
    v8: "8.1.307.31"
  },
  {
    name: "nodejs",
    version: "14.5.0",
    date: "2020-06-30",
    lts: false,
    security: false,
    v8: "8.3.110.9"
  },
  {
    name: "nodejs",
    version: "14.6.0",
    date: "2020-07-20",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.7.0",
    date: "2020-07-29",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.8.0",
    date: "2020-08-11",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.9.0",
    date: "2020-08-27",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.10.0",
    date: "2020-09-08",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.11.0",
    date: "2020-09-15",
    lts: false,
    security: true,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.12.0",
    date: "2020-09-22",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.13.0",
    date: "2020-09-29",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.14.0",
    date: "2020-10-15",
    lts: false,
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.15.0",
    date: "2020-10-27",
    lts: "Fermium",
    security: false,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.16.0",
    date: "2021-02-23",
    lts: "Fermium",
    security: true,
    v8: "8.4.371.19"
  },
  {
    name: "nodejs",
    version: "14.17.0",
    date: "2021-05-11",
    lts: "Fermium",
    security: false,
    v8: "8.4.371.23"
  },
  {
    name: "nodejs",
    version: "14.18.0",
    date: "2021-09-28",
    lts: "Fermium",
    security: false,
    v8: "8.4.371.23"
  },
  {
    name: "nodejs",
    version: "14.19.0",
    date: "2022-02-01",
    lts: "Fermium",
    security: false,
    v8: "8.4.371.23"
  },
  {
    name: "nodejs",
    version: "14.20.0",
    date: "2022-07-07",
    lts: "Fermium",
    security: true,
    v8: "8.4.371.23"
  },
  {
    name: "nodejs",
    version: "14.21.0",
    date: "2022-11-01",
    lts: "Fermium",
    security: false,
    v8: "8.4.371.23"
  },
  {
    name: "nodejs",
    version: "15.0.0",
    date: "2020-10-20",
    lts: false,
    security: false,
    v8: "8.6.395.16"
  },
  {
    name: "nodejs",
    version: "15.1.0",
    date: "2020-11-04",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.2.0",
    date: "2020-11-10",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.3.0",
    date: "2020-11-24",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.4.0",
    date: "2020-12-09",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.5.0",
    date: "2020-12-22",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.6.0",
    date: "2021-01-14",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.7.0",
    date: "2021-01-25",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.8.0",
    date: "2021-02-02",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.9.0",
    date: "2021-02-18",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.10.0",
    date: "2021-02-23",
    lts: false,
    security: true,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.11.0",
    date: "2021-03-03",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.12.0",
    date: "2021-03-17",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.13.0",
    date: "2021-03-31",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "15.14.0",
    date: "2021-04-06",
    lts: false,
    security: false,
    v8: "8.6.395.17"
  },
  {
    name: "nodejs",
    version: "16.0.0",
    date: "2021-04-20",
    lts: false,
    security: false,
    v8: "9.0.257.17"
  },
  {
    name: "nodejs",
    version: "16.1.0",
    date: "2021-05-04",
    lts: false,
    security: false,
    v8: "9.0.257.24"
  },
  {
    name: "nodejs",
    version: "16.2.0",
    date: "2021-05-19",
    lts: false,
    security: false,
    v8: "9.0.257.25"
  },
  {
    name: "nodejs",
    version: "16.3.0",
    date: "2021-06-03",
    lts: false,
    security: false,
    v8: "9.0.257.25"
  },
  {
    name: "nodejs",
    version: "16.4.0",
    date: "2021-06-23",
    lts: false,
    security: false,
    v8: "9.1.269.36"
  },
  {
    name: "nodejs",
    version: "16.5.0",
    date: "2021-07-14",
    lts: false,
    security: false,
    v8: "9.1.269.38"
  },
  {
    name: "nodejs",
    version: "16.6.0",
    date: "2021-07-29",
    lts: false,
    security: true,
    v8: "9.2.230.21"
  },
  {
    name: "nodejs",
    version: "16.7.0",
    date: "2021-08-18",
    lts: false,
    security: false,
    v8: "9.2.230.21"
  },
  {
    name: "nodejs",
    version: "16.8.0",
    date: "2021-08-25",
    lts: false,
    security: false,
    v8: "9.2.230.21"
  },
  {
    name: "nodejs",
    version: "16.9.0",
    date: "2021-09-07",
    lts: false,
    security: false,
    v8: "9.3.345.16"
  },
  {
    name: "nodejs",
    version: "16.10.0",
    date: "2021-09-22",
    lts: false,
    security: false,
    v8: "9.3.345.19"
  },
  {
    name: "nodejs",
    version: "16.11.0",
    date: "2021-10-08",
    lts: false,
    security: false,
    v8: "9.4.146.19"
  },
  {
    name: "nodejs",
    version: "16.12.0",
    date: "2021-10-20",
    lts: false,
    security: false,
    v8: "9.4.146.19"
  },
  {
    name: "nodejs",
    version: "16.13.0",
    date: "2021-10-26",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.19"
  },
  {
    name: "nodejs",
    version: "16.14.0",
    date: "2022-02-08",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.24"
  },
  {
    name: "nodejs",
    version: "16.15.0",
    date: "2022-04-26",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.24"
  },
  {
    name: "nodejs",
    version: "16.16.0",
    date: "2022-07-07",
    lts: "Gallium",
    security: true,
    v8: "9.4.146.24"
  },
  {
    name: "nodejs",
    version: "16.17.0",
    date: "2022-08-16",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.26"
  },
  {
    name: "nodejs",
    version: "16.18.0",
    date: "2022-10-12",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.26"
  },
  {
    name: "nodejs",
    version: "16.19.0",
    date: "2022-12-13",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.26"
  },
  {
    name: "nodejs",
    version: "16.20.0",
    date: "2023-03-28",
    lts: "Gallium",
    security: false,
    v8: "9.4.146.26"
  },
  {
    name: "nodejs",
    version: "17.0.0",
    date: "2021-10-19",
    lts: false,
    security: false,
    v8: "9.5.172.21"
  },
  {
    name: "nodejs",
    version: "17.1.0",
    date: "2021-11-09",
    lts: false,
    security: false,
    v8: "9.5.172.25"
  },
  {
    name: "nodejs",
    version: "17.2.0",
    date: "2021-11-30",
    lts: false,
    security: false,
    v8: "9.6.180.14"
  },
  {
    name: "nodejs",
    version: "17.3.0",
    date: "2021-12-17",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.4.0",
    date: "2022-01-18",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.5.0",
    date: "2022-02-10",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.6.0",
    date: "2022-02-22",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.7.0",
    date: "2022-03-09",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.8.0",
    date: "2022-03-22",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "17.9.0",
    date: "2022-04-07",
    lts: false,
    security: false,
    v8: "9.6.180.15"
  },
  {
    name: "nodejs",
    version: "18.0.0",
    date: "2022-04-18",
    lts: false,
    security: false,
    v8: "10.1.124.8"
  },
  {
    name: "nodejs",
    version: "18.1.0",
    date: "2022-05-03",
    lts: false,
    security: false,
    v8: "10.1.124.8"
  },
  {
    name: "nodejs",
    version: "18.2.0",
    date: "2022-05-17",
    lts: false,
    security: false,
    v8: "10.1.124.8"
  },
  {
    name: "nodejs",
    version: "18.3.0",
    date: "2022-06-02",
    lts: false,
    security: false,
    v8: "10.2.154.4"
  },
  {
    name: "nodejs",
    version: "18.4.0",
    date: "2022-06-16",
    lts: false,
    security: false,
    v8: "10.2.154.4"
  },
  {
    name: "nodejs",
    version: "18.5.0",
    date: "2022-07-06",
    lts: false,
    security: true,
    v8: "10.2.154.4"
  },
  {
    name: "nodejs",
    version: "18.6.0",
    date: "2022-07-13",
    lts: false,
    security: false,
    v8: "10.2.154.13"
  },
  {
    name: "nodejs",
    version: "18.7.0",
    date: "2022-07-26",
    lts: false,
    security: false,
    v8: "10.2.154.13"
  },
  {
    name: "nodejs",
    version: "18.8.0",
    date: "2022-08-24",
    lts: false,
    security: false,
    v8: "10.2.154.13"
  },
  {
    name: "nodejs",
    version: "18.9.0",
    date: "2022-09-07",
    lts: false,
    security: false,
    v8: "10.2.154.15"
  },
  {
    name: "nodejs",
    version: "18.10.0",
    date: "2022-09-28",
    lts: false,
    security: false,
    v8: "10.2.154.15"
  },
  {
    name: "nodejs",
    version: "18.11.0",
    date: "2022-10-13",
    lts: false,
    security: false,
    v8: "10.2.154.15"
  },
  {
    name: "nodejs",
    version: "18.12.0",
    date: "2022-10-25",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.15"
  },
  {
    name: "nodejs",
    version: "18.13.0",
    date: "2023-01-05",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.23"
  },
  {
    name: "nodejs",
    version: "18.14.0",
    date: "2023-02-01",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.23"
  },
  {
    name: "nodejs",
    version: "18.15.0",
    date: "2023-03-05",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "18.16.0",
    date: "2023-04-12",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "18.17.0",
    date: "2023-07-18",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "18.18.0",
    date: "2023-09-18",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "18.19.0",
    date: "2023-11-29",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "18.20.0",
    date: "2024-03-26",
    lts: "Hydrogen",
    security: false,
    v8: "10.2.154.26"
  },
  {
    name: "nodejs",
    version: "19.0.0",
    date: "2022-10-17",
    lts: false,
    security: false,
    v8: "10.7.193.13"
  },
  {
    name: "nodejs",
    version: "19.1.0",
    date: "2022-11-14",
    lts: false,
    security: false,
    v8: "10.7.193.20"
  },
  {
    name: "nodejs",
    version: "19.2.0",
    date: "2022-11-29",
    lts: false,
    security: false,
    v8: "10.8.168.20"
  },
  {
    name: "nodejs",
    version: "19.3.0",
    date: "2022-12-14",
    lts: false,
    security: false,
    v8: "10.8.168.21"
  },
  {
    name: "nodejs",
    version: "19.4.0",
    date: "2023-01-05",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "19.5.0",
    date: "2023-01-24",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "19.6.0",
    date: "2023-02-01",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "19.7.0",
    date: "2023-02-21",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "19.8.0",
    date: "2023-03-14",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "19.9.0",
    date: "2023-04-10",
    lts: false,
    security: false,
    v8: "10.8.168.25"
  },
  {
    name: "nodejs",
    version: "20.0.0",
    date: "2023-04-17",
    lts: false,
    security: false,
    v8: "11.3.244.4"
  },
  {
    name: "nodejs",
    version: "20.1.0",
    date: "2023-05-03",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.2.0",
    date: "2023-05-16",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.3.0",
    date: "2023-06-08",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.4.0",
    date: "2023-07-04",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.5.0",
    date: "2023-07-19",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.6.0",
    date: "2023-08-23",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.7.0",
    date: "2023-09-18",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.8.0",
    date: "2023-09-28",
    lts: false,
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.9.0",
    date: "2023-10-24",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.10.0",
    date: "2023-11-22",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.11.0",
    date: "2024-01-09",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.12.0",
    date: "2024-03-26",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.13.0",
    date: "2024-05-07",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.14.0",
    date: "2024-05-28",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.15.0",
    date: "2024-06-20",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.16.0",
    date: "2024-07-24",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.17.0",
    date: "2024-08-21",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "20.18.0",
    date: "2024-10-03",
    lts: "Iron",
    security: false,
    v8: "11.3.244.8"
  },
  {
    name: "nodejs",
    version: "21.0.0",
    date: "2023-10-17",
    lts: false,
    security: false,
    v8: "11.8.172.13"
  },
  {
    name: "nodejs",
    version: "21.1.0",
    date: "2023-10-24",
    lts: false,
    security: false,
    v8: "11.8.172.15"
  },
  {
    name: "nodejs",
    version: "21.2.0",
    date: "2023-11-14",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "21.3.0",
    date: "2023-11-30",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "21.4.0",
    date: "2023-12-05",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "21.5.0",
    date: "2023-12-19",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "21.6.0",
    date: "2024-01-14",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "21.7.0",
    date: "2024-03-06",
    lts: false,
    security: false,
    v8: "11.8.172.17"
  },
  {
    name: "nodejs",
    version: "22.0.0",
    date: "2024-04-24",
    lts: false,
    security: false,
    v8: "12.4.254.14"
  },
  {
    name: "nodejs",
    version: "22.1.0",
    date: "2024-05-02",
    lts: false,
    security: false,
    v8: "12.4.254.14"
  },
  {
    name: "nodejs",
    version: "22.2.0",
    date: "2024-05-15",
    lts: false,
    security: false,
    v8: "12.4.254.14"
  },
  {
    name: "nodejs",
    version: "22.3.0",
    date: "2024-06-11",
    lts: false,
    security: false,
    v8: "12.4.254.20"
  },
  {
    name: "nodejs",
    version: "22.4.0",
    date: "2024-07-02",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.5.0",
    date: "2024-07-17",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.6.0",
    date: "2024-08-06",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.7.0",
    date: "2024-08-21",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.8.0",
    date: "2024-09-03",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.9.0",
    date: "2024-09-17",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.10.0",
    date: "2024-10-16",
    lts: false,
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.11.0",
    date: "2024-10-29",
    lts: "Jod",
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "22.12.0",
    date: "2024-12-02",
    lts: "Jod",
    security: false,
    v8: "12.4.254.21"
  },
  {
    name: "nodejs",
    version: "23.0.0",
    date: "2024-10-16",
    lts: false,
    security: false,
    v8: "12.9.202.26"
  },
  {
    name: "nodejs",
    version: "23.1.0",
    date: "2024-10-24",
    lts: false,
    security: false,
    v8: "12.9.202.28"
  },
  {
    name: "nodejs",
    version: "23.2.0",
    date: "2024-11-11",
    lts: false,
    security: false,
    v8: "12.9.202.28"
  },
  {
    name: "nodejs",
    version: "23.3.0",
    date: "2024-11-20",
    lts: false,
    security: false,
    v8: "12.9.202.28"
  }
];

var agents$1 = {};

var browsers$1 = {};

var browsers;
var hasRequiredBrowsers$1;

function requireBrowsers$1 () {
	if (hasRequiredBrowsers$1) return browsers;
	hasRequiredBrowsers$1 = 1;
	browsers={A:"ie",B:"edge",C:"firefox",D:"chrome",E:"safari",F:"opera",G:"ios_saf",H:"op_mini",I:"android",J:"bb",K:"op_mob",L:"and_chr",M:"and_ff",N:"ie_mob",O:"and_uc",P:"samsung",Q:"and_qq",R:"baidu",S:"kaios"};
	return browsers;
}

var hasRequiredBrowsers;

function requireBrowsers () {
	if (hasRequiredBrowsers) return browsers$1;
	hasRequiredBrowsers = 1;
	browsers$1.browsers = requireBrowsers$1();
	return browsers$1;
}

var browserVersions$1 = {};

var browserVersions;
var hasRequiredBrowserVersions$1;

function requireBrowserVersions$1 () {
	if (hasRequiredBrowserVersions$1) return browserVersions;
	hasRequiredBrowserVersions$1 = 1;
	browserVersions={"0":"117","1":"20","2":"21","3":"22","4":"23","5":"24","6":"25","7":"26","8":"27","9":"118",A:"10",B:"11",C:"12",D:"7",E:"8",F:"9",G:"15",H:"80",I:"135",J:"4",K:"6",L:"13",M:"14",N:"16",O:"17",P:"18",Q:"79",R:"81",S:"83",T:"84",U:"85",V:"86",W:"87",X:"88",Y:"89",Z:"90",a:"91",b:"92",c:"93",d:"94",e:"95",f:"96",g:"97",h:"98",i:"99",j:"100",k:"101",l:"102",m:"103",n:"104",o:"105",p:"106",q:"107",r:"108",s:"109",t:"110",u:"111",v:"112",w:"113",x:"114",y:"115",z:"116",AB:"119",BB:"120",CB:"121",DB:"122",EB:"123",FB:"124",GB:"125",HB:"126",IB:"127",JB:"128",KB:"129",LB:"130",MB:"131",NB:"132",OB:"133",PB:"134",QB:"136",RB:"5",SB:"19",TB:"28",UB:"29",VB:"30",WB:"31",XB:"32",YB:"33",ZB:"34",aB:"35",bB:"36",cB:"37",dB:"38",eB:"39",fB:"40",gB:"41",hB:"42",iB:"43",jB:"44",kB:"45",lB:"46",mB:"47",nB:"48",oB:"49",pB:"50",qB:"51",rB:"52",sB:"53",tB:"54",uB:"55",vB:"56",wB:"57",xB:"58",yB:"60",zB:"62","0B":"63","1B":"64","2B":"65","3B":"66","4B":"67","5B":"68","6B":"69","7B":"70","8B":"71","9B":"72",AC:"73",BC:"74",CC:"75",DC:"76",EC:"77",FC:"78",GC:"137",HC:"11.1",IC:"12.1",JC:"15.5",KC:"16.0",LC:"17.0",MC:"18.0",NC:"3",OC:"59",PC:"61",QC:"82",RC:"138",SC:"139",TC:"3.2",UC:"10.1",VC:"15.2-15.3",WC:"15.4",XC:"16.1",YC:"16.2",ZC:"16.3",aC:"16.4",bC:"16.5",cC:"17.1",dC:"17.2",eC:"17.3",fC:"17.4",gC:"17.5",hC:"18.1",iC:"18.2",jC:"18.3",kC:"18.4",lC:"18.5",mC:"11.5",nC:"4.2-4.3",oC:"5.5",pC:"2",qC:"140",rC:"141",sC:"3.5",tC:"3.6",uC:"3.1",vC:"5.1",wC:"6.1",xC:"7.1",yC:"9.1",zC:"13.1","0C":"14.1","1C":"15.1","2C":"15.6","3C":"16.6","4C":"17.6","5C":"TP","6C":"9.5-9.6","7C":"10.0-10.1","8C":"10.5","9C":"10.6",AD:"11.6",BD:"4.0-4.1",CD:"5.0-5.1",DD:"6.0-6.1",ED:"7.0-7.1",FD:"8.1-8.4",GD:"9.0-9.2",HD:"9.3",ID:"10.0-10.2",JD:"10.3",KD:"11.0-11.2",LD:"11.3-11.4",MD:"12.0-12.1",ND:"12.2-12.5",OD:"13.0-13.1",PD:"13.2",QD:"13.3",RD:"13.4-13.7",SD:"14.0-14.4",TD:"14.5-14.8",UD:"15.0-15.1",VD:"15.6-15.8",WD:"16.6-16.7",XD:"17.6-17.7",YD:"all",ZD:"2.1",aD:"2.2",bD:"2.3",cD:"4.1",dD:"4.4",eD:"4.4.3-4.4.4",fD:"5.0-5.4",gD:"6.2-6.4",hD:"7.2-7.4",iD:"8.2",jD:"9.2",kD:"11.1-11.2",lD:"12.0",mD:"13.0",nD:"14.0",oD:"15.0",pD:"19.0",qD:"14.9",rD:"13.52",sD:"2.5",tD:"3.0-3.1"};
	return browserVersions;
}

var hasRequiredBrowserVersions;

function requireBrowserVersions () {
	if (hasRequiredBrowserVersions) return browserVersions$1;
	hasRequiredBrowserVersions = 1;
	browserVersions$1.browserVersions = requireBrowserVersions$1();
	return browserVersions$1;
}

var agents;
var hasRequiredAgents$1;

function requireAgents$1 () {
	if (hasRequiredAgents$1) return agents;
	hasRequiredAgents$1 = 1;
	agents={A:{A:{K:0,D:0,E:0,F:0.0324821,A:0,B:0.438508,oC:0},B:"ms",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","oC","K","D","E","F","A","B","","",""],E:"IE",F:{oC:962323200,K:998870400,D:1161129600,E:1237420800,F:1300060800,A:1346716800,B:1381968000}},B:{A:{"0":0.003623,"9":0.003623,C:0,L:0,M:0,G:0,N:0,O:0,P:0.097821,Q:0,H:0,R:0,S:0,T:0,U:0,V:0,W:0,X:0,Y:0,Z:0,a:0,b:0.010869,c:0,d:0,e:0,f:0,g:0,h:0,i:0,j:0,k:0,l:0,m:0,n:0,o:0,p:0,q:0,r:0.003623,s:0.047099,t:0,u:0,v:0,w:0.007246,x:0.014492,y:0.007246,z:0,AB:0.003623,BB:0.03623,CB:0.007246,DB:0.014492,EB:0.007246,FB:0.007246,GB:0.007246,HB:0.021738,IB:0.014492,JB:0.014492,KB:0.014492,LB:0.025361,MB:0.065214,NB:0.079706,OB:1.34051,PB:3.0252,I:0,QB:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","C","L","M","G","N","O","P","Q","H","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","9","AB","BB","CB","DB","EB","FB","GB","HB","IB","JB","KB","LB","MB","NB","OB","PB","I","QB","",""],E:"Edge",F:{"0":1694649600,"9":1697155200,C:1438128000,L:1447286400,M:1470096000,G:1491868800,N:1508198400,O:1525046400,P:1542067200,Q:1579046400,H:1581033600,R:1586736000,S:1590019200,T:1594857600,U:1598486400,V:1602201600,W:1605830400,X:1611360000,Y:1614816000,Z:1618358400,a:1622073600,b:1626912000,c:1630627200,d:1632441600,e:1634774400,f:1637539200,g:1641427200,h:1643932800,i:1646265600,j:1649635200,k:1651190400,l:1653955200,m:1655942400,n:1659657600,o:1661990400,p:1664755200,q:1666915200,r:1670198400,s:1673481600,t:1675900800,u:1678665600,v:1680825600,w:1683158400,x:1685664000,y:1689897600,z:1692576000,AB:1698969600,BB:1701993600,CB:1706227200,DB:1708732800,EB:1711152000,FB:1713398400,GB:1715990400,HB:1718841600,IB:1721865600,JB:1724371200,KB:1726704000,LB:1729123200,MB:1731542400,NB:1737417600,OB:1740614400,PB:1741219200,I:1743984000,QB:null},D:{C:"ms",L:"ms",M:"ms",G:"ms",N:"ms",O:"ms",P:"ms"}},C:{A:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0.094198,pC:0.007246,NC:0,J:0,RB:0,K:0,D:0,E:0,F:0,A:0,B:0.025361,C:0,L:0,M:0,G:0,N:0,O:0,P:0,SB:0,TB:0,UB:0,VB:0,WB:0,XB:0,YB:0,ZB:0,aB:0,bB:0,cB:0,dB:0,eB:0,fB:0,gB:0,hB:0,iB:0,jB:0.003623,kB:0,lB:0,mB:0,nB:0,oB:0,pB:0,qB:0,rB:0.028984,sB:0.014492,tB:0,uB:0.007246,vB:0.007246,wB:0,xB:0,OC:0.007246,yB:0,PC:0,zB:0,"0B":0,"1B":0,"2B":0,"3B":0,"4B":0,"5B":0,"6B":0,"7B":0,"8B":0,"9B":0.003623,AC:0,BC:0,CC:0,DC:0,EC:0,FC:0.010869,Q:0,H:0,R:0,QC:0,S:0,T:0,U:0,V:0,W:0,X:0.007246,Y:0,Z:0,a:0,b:0,c:0,d:0.003623,e:0,f:0,g:0,h:0,i:0,j:0,k:0,l:0,m:0,n:0,o:0,p:0,q:0,r:0,s:0.003623,t:0,u:0,v:0,w:0.003623,x:0,y:0.213757,z:0,AB:0,BB:0.003623,CB:0,DB:0,EB:0,FB:0,GB:0.014492,HB:0,IB:0.007246,JB:0.083329,KB:0,LB:0,MB:0.003623,NB:0.007246,OB:0.018115,PB:0.025361,I:0.347808,QB:1.11951,GC:0.007246,RC:0,SC:0,qC:0,rC:0,sC:0,tC:0},B:"moz",C:["pC","NC","sC","tC","J","RB","K","D","E","F","A","B","C","L","M","G","N","O","P","SB","1","2","3","4","5","6","7","8","TB","UB","VB","WB","XB","YB","ZB","aB","bB","cB","dB","eB","fB","gB","hB","iB","jB","kB","lB","mB","nB","oB","pB","qB","rB","sB","tB","uB","vB","wB","xB","OC","yB","PC","zB","0B","1B","2B","3B","4B","5B","6B","7B","8B","9B","AC","BC","CC","DC","EC","FC","Q","H","R","QC","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","9","AB","BB","CB","DB","EB","FB","GB","HB","IB","JB","KB","LB","MB","NB","OB","PB","I","QB","GC","RC","SC","qC","rC"],E:"Firefox",F:{"0":1693267200,"1":1361232000,"2":1364860800,"3":1368489600,"4":1372118400,"5":1375747200,"6":1379376000,"7":1386633600,"8":1391472000,"9":1695686400,pC:1161648000,NC:1213660800,sC:1246320000,tC:1264032000,J:1300752000,RB:1308614400,K:1313452800,D:1317081600,E:1317081600,F:1320710400,A:1324339200,B:1327968000,C:1331596800,L:1335225600,M:1338854400,G:1342483200,N:1346112000,O:1349740800,P:1353628800,SB:1357603200,TB:1395100800,UB:1398729600,VB:1402358400,WB:1405987200,XB:1409616000,YB:1413244800,ZB:1417392000,aB:1421107200,bB:1424736000,cB:1428278400,dB:1431475200,eB:1435881600,fB:1439251200,gB:1442880000,hB:1446508800,iB:1450137600,jB:1453852800,kB:1457395200,lB:1461628800,mB:1465257600,nB:1470096000,oB:1474329600,pB:1479168000,qB:1485216000,rB:1488844800,sB:1492560000,tB:1497312000,uB:1502150400,vB:1506556800,wB:1510617600,xB:1516665600,OC:1520985600,yB:1525824000,PC:1529971200,zB:1536105600,"0B":1540252800,"1B":1544486400,"2B":1548720000,"3B":1552953600,"4B":1558396800,"5B":1562630400,"6B":1567468800,"7B":1571788800,"8B":1575331200,"9B":1578355200,AC:1581379200,BC:1583798400,CC:1586304000,DC:1588636800,EC:1591056000,FC:1593475200,Q:1595894400,H:1598313600,R:1600732800,QC:1603152000,S:1605571200,T:1607990400,U:1611619200,V:1614038400,W:1616457600,X:1618790400,Y:1622505600,Z:1626134400,a:1628553600,b:1630972800,c:1633392000,d:1635811200,e:1638835200,f:1641859200,g:1644364800,h:1646697600,i:1649116800,j:1651536000,k:1653955200,l:1656374400,m:1658793600,n:1661212800,o:1663632000,p:1666051200,q:1668470400,r:1670889600,s:1673913600,t:1676332800,u:1678752000,v:1681171200,w:1683590400,x:1686009600,y:1688428800,z:1690848000,AB:1698105600,BB:1700524800,CB:1702944000,DB:1705968000,EB:1708387200,FB:1710806400,GB:1713225600,HB:1715644800,IB:1718064000,JB:1720483200,KB:1722902400,LB:1725321600,MB:1727740800,NB:1730160000,OB:1732579200,PB:1736208000,I:1738627200,QB:1741046400,GC:1743465600,RC:1745884800,SC:null,qC:null,rC:null}},D:{A:{"0":0.094198,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0.057968,J:0,RB:0,K:0,D:0,E:0,F:0,A:0,B:0,C:0,L:0,M:0,G:0,N:0,O:0,P:0,SB:0,TB:0,UB:0,VB:0,WB:0,XB:0,YB:0,ZB:0,aB:0,bB:0,cB:0,dB:0.003623,eB:0.007246,fB:0.003623,gB:0.007246,hB:0.007246,iB:0.007246,jB:0.007246,kB:0.007246,lB:0.003623,mB:0.007246,nB:0.018115,oB:0.018115,pB:0.007246,qB:0.007246,rB:0.010869,sB:0.007246,tB:0.007246,uB:0.007246,vB:0.014492,wB:0.007246,xB:0.010869,OC:0.007246,yB:0.007246,PC:0,zB:0,"0B":0,"1B":0,"2B":0,"3B":0.021738,"4B":0,"5B":0,"6B":0.010869,"7B":0.010869,"8B":0,"9B":0,AC:0.007246,BC:0.003623,CC:0.007246,DC:0.003623,EC:0.014492,FC:0.010869,Q:0.068837,H:0.010869,R:0.014492,S:0.028984,T:0.003623,U:0.010869,V:0.014492,W:0.057968,X:0.014492,Y:0.003623,Z:0.007246,a:0.03623,b:0.010869,c:0.014492,d:0.028984,e:0.007246,f:0.007246,g:0.018115,h:0.03623,i:0.010869,j:0.028984,k:0.014492,l:0.014492,m:0.076083,n:0.050722,o:0.010869,p:0.021738,q:0.025361,r:0.039853,s:0.912996,t:0.018115,u:0.03623,v:0.03623,w:0.10869,x:0.054345,y:0.032607,z:0.101444,AB:0.03623,BB:0.086952,CB:0.094198,DB:0.076083,EB:0.086952,FB:0.123182,GB:0.344185,HB:0.152166,IB:0.101444,JB:0.130428,KB:0.101444,LB:0.152166,MB:1.17747,NB:0.815175,OB:5.89462,PB:9.91615,I:0.021738,QB:0.014492,GC:0,RC:0,SC:0},B:"webkit",C:["","","","","","","","J","RB","K","D","E","F","A","B","C","L","M","G","N","O","P","SB","1","2","3","4","5","6","7","8","TB","UB","VB","WB","XB","YB","ZB","aB","bB","cB","dB","eB","fB","gB","hB","iB","jB","kB","lB","mB","nB","oB","pB","qB","rB","sB","tB","uB","vB","wB","xB","OC","yB","PC","zB","0B","1B","2B","3B","4B","5B","6B","7B","8B","9B","AC","BC","CC","DC","EC","FC","Q","H","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","9","AB","BB","CB","DB","EB","FB","GB","HB","IB","JB","KB","LB","MB","NB","OB","PB","I","QB","GC","RC","SC"],E:"Chrome",F:{"0":1694476800,"1":1337040000,"2":1340668800,"3":1343692800,"4":1348531200,"5":1352246400,"6":1357862400,"7":1361404800,"8":1364428800,"9":1696896000,J:1264377600,RB:1274745600,K:1283385600,D:1287619200,E:1291248000,F:1296777600,A:1299542400,B:1303862400,C:1307404800,L:1312243200,M:1316131200,G:1316131200,N:1319500800,O:1323734400,P:1328659200,SB:1332892800,TB:1369094400,UB:1374105600,VB:1376956800,WB:1384214400,XB:1389657600,YB:1392940800,ZB:1397001600,aB:1400544000,bB:1405468800,cB:1409011200,dB:1412640000,eB:1416268800,fB:1421798400,gB:1425513600,hB:1429401600,iB:1432080000,jB:1437523200,kB:1441152000,lB:1444780800,mB:1449014400,nB:1453248000,oB:1456963200,pB:1460592000,qB:1464134400,rB:1469059200,sB:1472601600,tB:1476230400,uB:1480550400,vB:1485302400,wB:1489017600,xB:1492560000,OC:1496707200,yB:1500940800,PC:1504569600,zB:1508198400,"0B":1512518400,"1B":1516752000,"2B":1520294400,"3B":1523923200,"4B":1527552000,"5B":1532390400,"6B":1536019200,"7B":1539648000,"8B":1543968000,"9B":1548720000,AC:1552348800,BC:1555977600,CC:1559606400,DC:1564444800,EC:1568073600,FC:1571702400,Q:1575936000,H:1580860800,R:1586304000,S:1589846400,T:1594684800,U:1598313600,V:1601942400,W:1605571200,X:1611014400,Y:1614556800,Z:1618272000,a:1621987200,b:1626739200,c:1630368000,d:1632268800,e:1634601600,f:1637020800,g:1641340800,h:1643673600,i:1646092800,j:1648512000,k:1650931200,l:1653350400,m:1655769600,n:1659398400,o:1661817600,p:1664236800,q:1666656000,r:1669680000,s:1673308800,t:1675728000,u:1678147200,v:1680566400,w:1682985600,x:1685404800,y:1689724800,z:1692057600,AB:1698710400,BB:1701993600,CB:1705968000,DB:1708387200,EB:1710806400,FB:1713225600,GB:1715644800,HB:1718064000,IB:1721174400,JB:1724112000,KB:1726531200,LB:1728950400,MB:1731369600,NB:1736812800,OB:1738627200,PB:1741046400,I:1743465600,QB:1745884800,GC:null,RC:null,SC:null}},E:{A:{J:0,RB:0,K:0,D:0,E:0,F:0,A:0,B:0,C:0,L:0,M:0.014492,G:0.003623,uC:0,TC:0,vC:0,wC:0,xC:0,yC:0,UC:0,HC:0.007246,IC:0.007246,zC:0.032607,"0C":0.043476,"1C":0.014492,VC:0.003623,WC:0.010869,JC:0.014492,"2C":0.148543,KC:0.032607,XC:0.021738,YC:0.018115,ZC:0.039853,aC:0.014492,bC:0.025361,"3C":0.199265,LC:0.010869,cC:0.123182,dC:0.018115,eC:0.021738,fC:0.050722,gC:0.086952,"4C":0.264479,MC:0.03623,hC:0.115936,iC:0.057968,jC:1.4021,kC:0.018115,lC:0,"5C":0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","uC","TC","J","RB","vC","K","wC","D","xC","E","F","yC","A","UC","B","HC","C","IC","L","zC","M","0C","G","1C","VC","WC","JC","2C","KC","XC","YC","ZC","aC","bC","3C","LC","cC","dC","eC","fC","gC","4C","MC","hC","iC","jC","kC","lC","5C",""],E:"Safari",F:{uC:1205798400,TC:1226534400,J:1244419200,RB:1275868800,vC:1311120000,K:1343174400,wC:1382400000,D:1382400000,xC:1410998400,E:1413417600,F:1443657600,yC:1458518400,A:1474329600,UC:1490572800,B:1505779200,HC:1522281600,C:1537142400,IC:1553472000,L:1568851200,zC:1585008000,M:1600214400,"0C":1619395200,G:1632096000,"1C":1635292800,VC:1639353600,WC:1647216000,JC:1652745600,"2C":1658275200,KC:1662940800,XC:1666569600,YC:1670889600,ZC:1674432000,aC:1679875200,bC:1684368000,"3C":1690156800,LC:1695686400,cC:1698192000,dC:1702252800,eC:1705881600,fC:1709596800,gC:1715558400,"4C":1722211200,MC:1726444800,hC:1730073600,iC:1733875200,jC:1737936000,kC:1743379200,lC:null,"5C":null}},F:{A:{"0":0.684747,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,F:0,B:0,C:0,G:0,N:0,O:0,P:0,SB:0,TB:0,UB:0,VB:0,WB:0,XB:0,YB:0,ZB:0,aB:0,bB:0,cB:0,dB:0,eB:0,fB:0.003623,gB:0,hB:0,iB:0,jB:0,kB:0,lB:0.010869,mB:0,nB:0,oB:0,pB:0,qB:0,rB:0,sB:0,tB:0,uB:0,vB:0,wB:0,xB:0,yB:0,zB:0,"0B":0,"1B":0,"2B":0,"3B":0,"4B":0,"5B":0,"6B":0,"7B":0,"8B":0,"9B":0,AC:0,BC:0,CC:0,DC:0,EC:0,FC:0,Q:0,H:0,R:0,QC:0,S:0,T:0,U:0,V:0,W:0.025361,X:0.007246,Y:0,Z:0,a:0,b:0,c:0,d:0,e:0.032607,f:0,g:0,h:0,i:0,j:0,k:0,l:0.018115,m:0,n:0,o:0,p:0,q:0,r:0,s:0,t:0,u:0,v:0,w:0,x:0.003623,y:0,z:0.202888,"6C":0,"7C":0,"8C":0,"9C":0,HC:0,mC:0,AD:0,IC:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","F","6C","7C","8C","9C","B","HC","mC","AD","C","IC","G","N","O","P","SB","1","2","3","4","5","6","7","8","TB","UB","VB","WB","XB","YB","ZB","aB","bB","cB","dB","eB","fB","gB","hB","iB","jB","kB","lB","mB","nB","oB","pB","qB","rB","sB","tB","uB","vB","wB","xB","yB","zB","0B","1B","2B","3B","4B","5B","6B","7B","8B","9B","AC","BC","CC","DC","EC","FC","Q","H","R","QC","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","","",""],E:"Opera",F:{"0":1739404800,"1":1393891200,"2":1399334400,"3":1401753600,"4":1405987200,"5":1409616000,"6":1413331200,"7":1417132800,"8":1422316800,F:1150761600,"6C":1223424000,"7C":1251763200,"8C":1267488000,"9C":1277942400,B:1292457600,HC:1302566400,mC:1309219200,AD:1323129600,C:1323129600,IC:1352073600,G:1372723200,N:1377561600,O:1381104000,P:1386288000,SB:1390867200,TB:1425945600,UB:1430179200,VB:1433808000,WB:1438646400,XB:1442448000,YB:1445904000,ZB:1449100800,aB:1454371200,bB:1457308800,cB:1462320000,dB:1465344000,eB:1470096000,fB:1474329600,gB:1477267200,hB:1481587200,iB:1486425600,jB:1490054400,kB:1494374400,lB:1498003200,mB:1502236800,nB:1506470400,oB:1510099200,pB:1515024000,qB:1517961600,rB:1521676800,sB:1525910400,tB:1530144000,uB:1534982400,vB:1537833600,wB:1543363200,xB:1548201600,yB:1554768000,zB:1561593600,"0B":1566259200,"1B":1570406400,"2B":1573689600,"3B":1578441600,"4B":1583971200,"5B":1587513600,"6B":1592956800,"7B":1595894400,"8B":1600128000,"9B":1603238400,AC:1613520000,BC:1612224000,CC:1616544000,DC:1619568000,EC:1623715200,FC:1627948800,Q:1631577600,H:1633392000,R:1635984000,QC:1638403200,S:1642550400,T:1644969600,U:1647993600,V:1650412800,W:1652745600,X:1654646400,Y:1657152000,Z:1660780800,a:1663113600,b:1668816000,c:1668643200,d:1671062400,e:1675209600,f:1677024000,g:1679529600,h:1681948800,i:1684195200,j:1687219200,k:1690329600,l:1692748800,m:1696204800,n:1699920000,o:1699920000,p:1702944000,q:1707264000,r:1710115200,s:1711497600,t:1716336000,u:1719273600,v:1721088000,w:1724284800,x:1727222400,y:1732665600,z:1736294400},D:{F:"o",B:"o",C:"o","6C":"o","7C":"o","8C":"o","9C":"o",HC:"o",mC:"o",AD:"o",IC:"o"}},G:{A:{E:0,TC:0,BD:0,nC:0.00289898,CD:0,DD:0.00869695,ED:0.00724746,FD:0,GD:0.00434848,HD:0.0202929,ID:0.00144949,JD:0.0333383,KD:0.153646,LD:0.0101464,MD:0.00579797,ND:0.14205,OD:0.00289898,PD:0.00579797,QD:0.00579797,RD:0.0202929,SD:0.124656,TD:0.0608787,UD:0.0333383,VC:0.0333383,WC:0.0405858,JC:0.0463837,VD:0.568201,KC:0.0797221,XC:0.165242,YC:0.08552,ZC:0.150747,aC:0.0333383,bC:0.0623282,WD:0.672564,LC:0.0405858,cC:0.0724746,dC:0.0550807,eC:0.0768231,fC:0.153646,gC:0.340631,XD:0.988554,MC:0.276853,hC:0.905933,iC:0.405858,jC:8.46503,kC:0.126106,lC:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","TC","BD","nC","CD","DD","ED","E","FD","GD","HD","ID","JD","KD","LD","MD","ND","OD","PD","QD","RD","SD","TD","UD","VC","WC","JC","VD","KC","XC","YC","ZC","aC","bC","WD","LC","cC","dC","eC","fC","gC","XD","MC","hC","iC","jC","kC","lC","",""],E:"Safari on iOS",F:{TC:1270252800,BD:1283904000,nC:1299628800,CD:1331078400,DD:1359331200,ED:1394409600,E:1410912000,FD:1413763200,GD:1442361600,HD:1458518400,ID:1473724800,JD:1490572800,KD:1505779200,LD:1522281600,MD:1537142400,ND:1553472000,OD:1568851200,PD:1572220800,QD:1580169600,RD:1585008000,SD:1600214400,TD:1619395200,UD:1632096000,VC:1639353600,WC:1647216000,JC:1652659200,VD:1658275200,KC:1662940800,XC:1666569600,YC:1670889600,ZC:1674432000,aC:1679875200,bC:1684368000,WD:1690156800,LC:1694995200,cC:1698192000,dC:1702252800,eC:1705881600,fC:1709596800,gC:1715558400,XD:1722211200,MC:1726444800,hC:1730073600,iC:1733875200,jC:1737936000,kC:1743379200,lC:null}},H:{A:{YD:0.05},B:"o",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","YD","","",""],E:"Opera Mini",F:{YD:1426464000}},I:{A:{NC:0,J:0,I:0.871727,ZD:0,aD:0,bD:0,cD:0,nC:0.000262095,dD:0,eD:0.000961014},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","ZD","aD","bD","NC","J","cD","nC","dD","eD","I","","",""],E:"Android Browser",F:{ZD:1256515200,aD:1274313600,bD:1291593600,NC:1298332800,J:1318896000,cD:1341792000,nC:1374624000,dD:1386547200,eD:1401667200,I:1743379200}},J:{A:{D:0,A:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","D","A","","",""],E:"Blackberry Browser",F:{D:1325376000,A:1359504000}},K:{A:{A:0,B:0,C:0,H:1.04047,HC:0,mC:0,IC:0},B:"o",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","A","B","HC","mC","C","IC","H","","",""],E:"Opera Mobile",F:{A:1287100800,B:1300752000,HC:1314835200,mC:1318291200,C:1330300800,IC:1349740800,H:1709769600},D:{H:"webkit"}},L:{A:{I:44.6783},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","I","","",""],E:"Chrome for Android",F:{I:1743379200}},M:{A:{GC:0.350735},B:"moz",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","GC","","",""],E:"Firefox for Android",F:{GC:1743465600}},N:{A:{A:0,B:0},B:"ms",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","A","B","","",""],E:"IE Mobile",F:{A:1340150400,B:1353456000}},O:{A:{JC:0.848141},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","JC","","",""],E:"UC Browser for Android",F:{JC:1710115200},D:{JC:"webkit"}},P:{A:{"1":0,"2":0.0219344,"3":0.0219344,"4":0.0329016,"5":0.0438688,"6":0.0438688,"7":0.0877377,"8":1.96313,J:0.0329016,fD:0,gD:0,hD:0.0109672,iD:0,jD:0,UC:0,kD:0,lD:0,mD:0,nD:0,oD:0,KC:0,LC:0.0109672,MC:0,pD:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","J","fD","gD","hD","iD","jD","UC","kD","lD","mD","nD","oD","KC","LC","MC","pD","1","2","3","4","5","6","7","8","","",""],E:"Samsung Internet",F:{"1":1677369600,"2":1684454400,"3":1689292800,"4":1697587200,"5":1711497600,"6":1715126400,"7":1717718400,"8":1725667200,J:1461024000,fD:1481846400,gD:1509408000,hD:1528329600,iD:1546128000,jD:1554163200,UC:1567900800,kD:1582588800,lD:1593475200,mD:1605657600,nD:1618531200,oD:1629072000,KC:1640736000,LC:1651708800,MC:1659657600,pD:1667260800}},Q:{A:{qD:0.229572},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","qD","","",""],E:"QQ Browser",F:{qD:1710288000}},R:{A:{rD:0},B:"webkit",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","rD","","",""],E:"Baidu Browser",F:{rD:1710201600}},S:{A:{sD:0.012754,tD:0},B:"moz",C:["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","sD","tD","","",""],E:"KaiOS Browser",F:{sD:1527811200,tD:1631664000}}};
	return agents;
}

var hasRequiredAgents;

function requireAgents () {
	if (hasRequiredAgents) return agents$1;
	hasRequiredAgents = 1;

	const browsers = requireBrowsers().browsers;
	const versions = requireBrowserVersions().browserVersions;
	const agentsData = requireAgents$1();

	function unpackBrowserVersions(versionsData) {
	  return Object.keys(versionsData).reduce((usage, version) => {
	    usage[versions[version]] = versionsData[version];
	    return usage
	  }, {})
	}

	agents$1.agents = Object.keys(agentsData).reduce((map, key) => {
	  let versionsData = agentsData[key];
	  map[browsers[key]] = Object.keys(versionsData).reduce((data, entry) => {
	    if (entry === 'A') {
	      data.usage_global = unpackBrowserVersions(versionsData[entry]);
	    } else if (entry === 'C') {
	      data.versions = versionsData[entry].reduce((list, version) => {
	        if (version === '') {
	          list.push(null);
	        } else {
	          list.push(versions[version]);
	        }
	        return list
	      }, []);
	    } else if (entry === 'D') {
	      data.prefix_exceptions = unpackBrowserVersions(versionsData[entry]);
	    } else if (entry === 'E') {
	      data.browser = versionsData[entry];
	    } else if (entry === 'F') {
	      data.release_date = Object.keys(versionsData[entry]).reduce(
	        (map2, key2) => {
	          map2[versions[key2]] = versionsData[entry][key2];
	          return map2
	        },
	        {}
	      );
	    } else {
	      // entry is B
	      data.prefix = versionsData[entry];
	    }
	    return data
	  }, {});
	  return map
	}, {});
	return agents$1;
}

var versions;
var hasRequiredVersions;

function requireVersions () {
	if (hasRequiredVersions) return versions;
	hasRequiredVersions = 1;
	versions = {
		"0.20": "39",
		"0.21": "41",
		"0.22": "41",
		"0.23": "41",
		"0.24": "41",
		"0.25": "42",
		"0.26": "42",
		"0.27": "43",
		"0.28": "43",
		"0.29": "43",
		"0.30": "44",
		"0.31": "45",
		"0.32": "45",
		"0.33": "45",
		"0.34": "45",
		"0.35": "45",
		"0.36": "47",
		"0.37": "49",
		"1.0": "49",
		"1.1": "50",
		"1.2": "51",
		"1.3": "52",
		"1.4": "53",
		"1.5": "54",
		"1.6": "56",
		"1.7": "58",
		"1.8": "59",
		"2.0": "61",
		"2.1": "61",
		"3.0": "66",
		"3.1": "66",
		"4.0": "69",
		"4.1": "69",
		"4.2": "69",
		"5.0": "73",
		"6.0": "76",
		"6.1": "76",
		"7.0": "78",
		"7.1": "78",
		"7.2": "78",
		"7.3": "78",
		"8.0": "80",
		"8.1": "80",
		"8.2": "80",
		"8.3": "80",
		"8.4": "80",
		"8.5": "80",
		"9.0": "83",
		"9.1": "83",
		"9.2": "83",
		"9.3": "83",
		"9.4": "83",
		"10.0": "85",
		"10.1": "85",
		"10.2": "85",
		"10.3": "85",
		"10.4": "85",
		"11.0": "87",
		"11.1": "87",
		"11.2": "87",
		"11.3": "87",
		"11.4": "87",
		"11.5": "87",
		"12.0": "89",
		"12.1": "89",
		"12.2": "89",
		"13.0": "91",
		"13.1": "91",
		"13.2": "91",
		"13.3": "91",
		"13.4": "91",
		"13.5": "91",
		"13.6": "91",
		"14.0": "93",
		"14.1": "93",
		"14.2": "93",
		"15.0": "94",
		"15.1": "94",
		"15.2": "94",
		"15.3": "94",
		"15.4": "94",
		"15.5": "94",
		"16.0": "96",
		"16.1": "96",
		"16.2": "96",
		"17.0": "98",
		"17.1": "98",
		"17.2": "98",
		"17.3": "98",
		"17.4": "98",
		"18.0": "100",
		"18.1": "100",
		"18.2": "100",
		"18.3": "100",
		"19.0": "102",
		"19.1": "102",
		"20.0": "104",
		"20.1": "104",
		"20.2": "104",
		"20.3": "104",
		"21.0": "106",
		"21.1": "106",
		"21.2": "106",
		"21.3": "106",
		"21.4": "106",
		"22.0": "108",
		"22.1": "108",
		"22.2": "108",
		"22.3": "108",
		"23.0": "110",
		"23.1": "110",
		"23.2": "110",
		"23.3": "110",
		"24.0": "112",
		"24.1": "112",
		"24.2": "112",
		"24.3": "112",
		"24.4": "112",
		"24.5": "112",
		"24.6": "112",
		"24.7": "112",
		"24.8": "112",
		"25.0": "114",
		"25.1": "114",
		"25.2": "114",
		"25.3": "114",
		"25.4": "114",
		"25.5": "114",
		"25.6": "114",
		"25.7": "114",
		"25.8": "114",
		"25.9": "114",
		"26.0": "116",
		"26.1": "116",
		"26.2": "116",
		"26.3": "116",
		"26.4": "116",
		"26.5": "116",
		"26.6": "116",
		"27.0": "118",
		"27.1": "118",
		"27.2": "118",
		"27.3": "118",
		"28.0": "120",
		"28.1": "120",
		"28.2": "120",
		"28.3": "120",
		"29.0": "122",
		"29.1": "122",
		"29.2": "122",
		"29.3": "122",
		"29.4": "122",
		"30.0": "124",
		"30.1": "124",
		"30.2": "124",
		"30.3": "124",
		"30.4": "124",
		"30.5": "124",
		"31.0": "126",
		"31.1": "126",
		"31.2": "126",
		"31.3": "126",
		"31.4": "126",
		"31.5": "126",
		"31.6": "126",
		"31.7": "126",
		"32.0": "128",
		"32.1": "128",
		"32.2": "128",
		"32.3": "128",
		"33.0": "130",
		"33.1": "130",
		"33.2": "130",
		"33.3": "130",
		"33.4": "130",
		"34.0": "132",
		"34.1": "132",
		"34.2": "132",
		"34.3": "132",
		"34.4": "132",
		"34.5": "132",
		"35.0": "134",
		"35.1": "134",
		"35.2": "134",
		"36.0": "136",
		"36.1": "136",
		"37.0": "137"
	};
	return versions;
}

const v4 = {
  start: "2015-09-08",
  lts: "2015-10-12",
  maintenance: "2017-04-01",
  end: "2018-04-30",
  codename: "Argon"
};
const v5 = {
  start: "2015-10-29",
  maintenance: "2016-04-30",
  end: "2016-06-30"
};
const v6 = {
  start: "2016-04-26",
  lts: "2016-10-18",
  maintenance: "2018-04-30",
  end: "2019-04-30",
  codename: "Boron"
};
const v7 = {
  start: "2016-10-25",
  maintenance: "2017-04-30",
  end: "2017-06-30"
};
const v8 = {
  start: "2017-05-30",
  lts: "2017-10-31",
  maintenance: "2019-01-01",
  end: "2019-12-31",
  codename: "Carbon"
};
const v9 = {
  start: "2017-10-01",
  maintenance: "2018-04-01",
  end: "2018-06-30"
};
const v10 = {
  start: "2018-04-24",
  lts: "2018-10-30",
  maintenance: "2020-05-19",
  end: "2021-04-30",
  codename: "Dubnium"
};
const v11 = {
  start: "2018-10-23",
  maintenance: "2019-04-22",
  end: "2019-06-01"
};
const v12 = {
  start: "2019-04-23",
  lts: "2019-10-21",
  maintenance: "2020-11-30",
  end: "2022-04-30",
  codename: "Erbium"
};
const v13 = {
  start: "2019-10-22",
  maintenance: "2020-04-01",
  end: "2020-06-01"
};
const v14 = {
  start: "2020-04-21",
  lts: "2020-10-27",
  maintenance: "2021-10-19",
  end: "2023-04-30",
  codename: "Fermium"
};
const v15 = {
  start: "2020-10-20",
  maintenance: "2021-04-01",
  end: "2021-06-01"
};
const v16 = {
  start: "2021-04-20",
  lts: "2021-10-26",
  maintenance: "2022-10-18",
  end: "2023-09-11",
  codename: "Gallium"
};
const v17 = {
  start: "2021-10-19",
  maintenance: "2022-04-01",
  end: "2022-06-01"
};
const v18 = {
  start: "2022-04-19",
  lts: "2022-10-25",
  maintenance: "2023-10-18",
  end: "2025-04-30",
  codename: "Hydrogen"
};
const v19 = {
  start: "2022-10-18",
  maintenance: "2023-04-01",
  end: "2023-06-01"
};
const v20 = {
  start: "2023-04-18",
  lts: "2023-10-24",
  maintenance: "2024-10-22",
  end: "2026-04-30",
  codename: "Iron"
};
const v21 = {
  start: "2023-10-17",
  maintenance: "2024-04-01",
  end: "2024-06-01"
};
const v22 = {
  start: "2024-04-24",
  lts: "2024-10-29",
  maintenance: "2025-10-21",
  end: "2027-04-30",
  codename: "Jod"
};
const v23 = {
  start: "2024-10-16",
  maintenance: "2025-04-01",
  end: "2025-06-01"
};
const v24 = {
  start: "2025-04-22",
  lts: "2025-10-28",
  maintenance: "2026-10-20",
  end: "2028-04-30",
  codename: ""
};
var require$$3 = {
  "v0.8": {
  start: "2012-06-25",
  end: "2014-07-31"
},
  "v0.10": {
  start: "2013-03-11",
  end: "2016-10-31"
},
  "v0.12": {
  start: "2015-02-06",
  end: "2016-12-31"
},
  v4: v4,
  v5: v5,
  v6: v6,
  v7: v7,
  v8: v8,
  v9: v9,
  v10: v10,
  v11: v11,
  v12: v12,
  v13: v13,
  v14: v14,
  v15: v15,
  v16: v16,
  v17: v17,
  v18: v18,
  v19: v19,
  v20: v20,
  v21: v21,
  v22: v22,
  v23: v23,
  v24: v24
};

var error;
var hasRequiredError;

function requireError () {
	if (hasRequiredError) return error;
	hasRequiredError = 1;
	function BrowserslistError(message) {
	  this.name = 'BrowserslistError';
	  this.message = message;
	  this.browserslist = true;
	  if (Error.captureStackTrace) {
	    Error.captureStackTrace(this, BrowserslistError);
	  }
	}

	BrowserslistError.prototype = Error.prototype;

	error = BrowserslistError;
	return error;
}

function commonjsRequire(path) {
	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}

var node = {exports: {}};

var feature = {exports: {}};

var statuses;
var hasRequiredStatuses;

function requireStatuses () {
	if (hasRequiredStatuses) return statuses;
	hasRequiredStatuses = 1;
	statuses = {
	  1: 'ls', // WHATWG Living Standard
	  2: 'rec', // W3C Recommendation
	  3: 'pr', // W3C Proposed Recommendation
	  4: 'cr', // W3C Candidate Recommendation
	  5: 'wd', // W3C Working Draft
	  6: 'other', // Non-W3C, but reputable
	  7: 'unoff' // Unofficial, Editor's Draft or W3C "Note"
	};
	return statuses;
}

var supported;
var hasRequiredSupported;

function requireSupported () {
	if (hasRequiredSupported) return supported;
	hasRequiredSupported = 1;
	supported = {
	  y: 1 << 0,
	  n: 1 << 1,
	  a: 1 << 2,
	  p: 1 << 3,
	  u: 1 << 4,
	  x: 1 << 5,
	  d: 1 << 6
	};
	return supported;
}

var hasRequiredFeature;

function requireFeature () {
	if (hasRequiredFeature) return feature.exports;
	hasRequiredFeature = 1;

	const statuses = requireStatuses();
	const supported = requireSupported();
	const browsers = requireBrowsers().browsers;
	const versions = requireBrowserVersions().browserVersions;

	const MATH2LOG = Math.log(2);

	function unpackSupport(cipher) {
	  // bit flags
	  let stats = Object.keys(supported).reduce((list, support) => {
	    if (cipher & supported[support]) list.push(support);
	    return list
	  }, []);

	  // notes
	  let notes = cipher >> 7;
	  let notesArray = [];
	  while (notes) {
	    let note = Math.floor(Math.log(notes) / MATH2LOG) + 1;
	    notesArray.unshift(`#${note}`);
	    notes -= Math.pow(2, note - 1);
	  }

	  return stats.concat(notesArray).join(' ')
	}

	function unpackFeature(packed) {
	  let unpacked = {
	    status: statuses[packed.B],
	    title: packed.C,
	    shown: packed.D
	  };
	  unpacked.stats = Object.keys(packed.A).reduce((browserStats, key) => {
	    let browser = packed.A[key];
	    browserStats[browsers[key]] = Object.keys(browser).reduce(
	      (stats, support) => {
	        let packedVersions = browser[support].split(' ');
	        let unpacked2 = unpackSupport(support);
	        packedVersions.forEach(v => (stats[versions[v]] = unpacked2));
	        return stats
	      },
	      {}
	    );
	    return browserStats
	  }, {});
	  return unpacked
	}

	feature.exports = unpackFeature;
	feature.exports.default = unpackFeature;
	return feature.exports;
}

var region = {exports: {}};

var hasRequiredRegion;

function requireRegion () {
	if (hasRequiredRegion) return region.exports;
	hasRequiredRegion = 1;

	const browsers = requireBrowsers().browsers;

	function unpackRegion(packed) {
	  return Object.keys(packed).reduce((list, browser) => {
	    let data = packed[browser];
	    list[browsers[browser]] = Object.keys(data).reduce((memo, key) => {
	      let stats = data[key];
	      if (key === '_') {
	        stats.split(' ').forEach(version => (memo[version] = null));
	      } else {
	        memo[key] = stats;
	      }
	      return memo
	    }, {});
	    return list
	  }, {})
	}

	region.exports = unpackRegion;
	region.exports.default = unpackRegion;
	return region.exports;
}

var hasRequiredNode;

function requireNode () {
	if (hasRequiredNode) return node.exports;
	hasRequiredNode = 1;
	(function (module) {
		var feature = requireFeature().default;
		var region = requireRegion().default;
		var fs = require$$2;
		var path = require$$3$1;

		var BrowserslistError = requireError();

		var IS_SECTION = /^\s*\[(.+)]\s*$/;
		var CONFIG_PATTERN = /^browserslist-config-/;
		var SCOPED_CONFIG__PATTERN = /@[^/]+(?:\/[^/]+)?\/browserslist-config(?:-|$|\/)/;
		var FORMAT =
		  'Browserslist config should be a string or an array ' +
		  'of strings with browser queries';

		var dataTimeChecked = false;
		var statCache = {};
		var configPathCache = {};
		var parseConfigCache = {};

		function checkExtend(name) {
		  var use = ' Use `dangerousExtend` option to disable.';
		  if (!CONFIG_PATTERN.test(name) && !SCOPED_CONFIG__PATTERN.test(name)) {
		    throw new BrowserslistError(
		      'Browserslist config needs `browserslist-config-` prefix. ' + use
		    )
		  }
		  if (name.replace(/^@[^/]+\//, '').indexOf('.') !== -1) {
		    throw new BrowserslistError(
		      '`.` not allowed in Browserslist config name. ' + use
		    )
		  }
		  if (name.indexOf('node_modules') !== -1) {
		    throw new BrowserslistError(
		      '`node_modules` not allowed in Browserslist config.' + use
		    )
		  }
		}

		function isFile(file) {
		  return fs.existsSync(file) && fs.statSync(file).isFile()
		}
		function isDirectory(dir) {
		  return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
		}

		function eachParent(file, callback, cache) {
		  var loc = path.resolve(file);
		  var pathsForCacheResult = [];
		  var result;
		  do {
		    if (!pathInRoot(loc)) {
		      break
		    }
		    if (cache && loc in cache) {
		      result = cache[loc];
		      break
		    }
		    pathsForCacheResult.push(loc);

		    if (!isDirectory(loc)) {
		      continue
		    }

		    var locResult = callback(loc);
		    if (typeof locResult !== 'undefined') {
		      result = locResult;
		      break
		    }
		  } while (loc !== (loc = path.dirname(loc)))

		  if (cache && !process.env.BROWSERSLIST_DISABLE_CACHE) {
		    pathsForCacheResult.forEach(function (cachePath) {
		      cache[cachePath] = result;
		    });
		  }
		  return result
		}

		function pathInRoot(p) {
		  if (!process.env.BROWSERSLIST_ROOT_PATH) return true
		  var rootPath = path.resolve(process.env.BROWSERSLIST_ROOT_PATH);
		  if (path.relative(rootPath, p).substring(0, 2) === '..') {
		    return false
		  }
		  return true
		}

		function check(section) {
		  if (Array.isArray(section)) {
		    for (var i = 0; i < section.length; i++) {
		      if (typeof section[i] !== 'string') {
		        throw new BrowserslistError(FORMAT)
		      }
		    }
		  } else if (typeof section !== 'string') {
		    throw new BrowserslistError(FORMAT)
		  }
		}

		function pickEnv(config, opts) {
		  if (typeof config !== 'object') return config

		  var name;
		  if (typeof opts.env === 'string') {
		    name = opts.env;
		  } else if (process.env.BROWSERSLIST_ENV) {
		    name = process.env.BROWSERSLIST_ENV;
		  } else {
		    name = ("production");
		  }

		  if (opts.throwOnMissing) {
		    if (name && name !== 'defaults' && !config[name]) {
		      throw new BrowserslistError(
		        'Missing config for Browserslist environment `' + name + '`'
		      )
		    }
		  }

		  return config[name] || config.defaults
		}

		function parsePackage(file) {
		  var text = fs
		    .readFileSync(file)
		    .toString()
		    .replace(/^\uFEFF/m, '');
		  var list;
		  if (text.indexOf('"browserslist"') >= 0) {
		    list = JSON.parse(text).browserslist;
		  } else if (text.indexOf('"browserlist"') >= 0) {
		    var config = JSON.parse(text);
		    if (config.browserlist && !config.browserslist) {
		      throw new BrowserslistError(
		        '`browserlist` key instead of `browserslist` in ' + file
		      )
		    }
		  }
		  if (Array.isArray(list) || typeof list === 'string') {
		    list = { defaults: list };
		  }
		  for (var i in list) {
		    check(list[i]);
		  }

		  return list
		}

		function parsePackageOrReadConfig(file) {
		  if (file in parseConfigCache) {
		    return parseConfigCache[file]
		  }

		  var isPackage = path.basename(file) === 'package.json';
		  var result = isPackage ? parsePackage(file) : module.exports.readConfig(file);

		  if (!process.env.BROWSERSLIST_DISABLE_CACHE) {
		    parseConfigCache[file] = result;
		  }
		  return result
		}

		function latestReleaseTime(agents) {
		  var latest = 0;
		  for (var name in agents) {
		    var dates = agents[name].releaseDate || {};
		    for (var key in dates) {
		      if (latest < dates[key]) {
		        latest = dates[key];
		      }
		    }
		  }
		  return latest * 1000
		}

		function getMonthsPassed(date) {
		  var now = new Date();
		  var past = new Date(date);

		  var years = now.getFullYear() - past.getFullYear();
		  var months = now.getMonth() - past.getMonth();

		  return years * 12 + months
		}

		function normalizeStats(data, stats) {
		  if (!data) {
		    data = {};
		  }
		  if (stats && 'dataByBrowser' in stats) {
		    stats = stats.dataByBrowser;
		  }

		  if (typeof stats !== 'object') return undefined

		  var normalized = {};
		  for (var i in stats) {
		    var versions = Object.keys(stats[i]);
		    if (versions.length === 1 && data[i] && data[i].versions.length === 1) {
		      var normal = data[i].versions[0];
		      normalized[i] = {};
		      normalized[i][normal] = stats[i][versions[0]];
		    } else {
		      normalized[i] = stats[i];
		    }
		  }

		  return normalized
		}

		function normalizeUsageData(usageData, data) {
		  for (var browser in usageData) {
		    var browserUsage = usageData[browser];
		    // https://github.com/browserslist/browserslist/issues/431#issuecomment-565230615
		    // caniuse-db returns { 0: "percentage" } for `and_*` regional stats
		    if ('0' in browserUsage) {
		      var versions = data[browser].versions;
		      browserUsage[versions[versions.length - 1]] = browserUsage[0];
		      delete browserUsage[0];
		    }
		  }
		}

		module.exports = {
		  loadQueries: function loadQueries(ctx, name) {
		    if (!ctx.dangerousExtend && !process.env.BROWSERSLIST_DANGEROUS_EXTEND) {
		      checkExtend(name);
		    }
		    var queries = commonjsRequire(require.resolve(name, { paths: ['.', ctx.path] }));
		    if (typeof queries === 'object' && queries !== null && queries.__esModule) {
		      queries = queries.default;
		    }
		    if (queries) {
		      if (Array.isArray(queries)) {
		        return queries
		      } else if (typeof queries === 'object') {
		        if (!queries.defaults) queries.defaults = [];
		        return pickEnv(queries, ctx)
		      }
		    }
		    throw new BrowserslistError(
		      '`' +
		        name +
		        '` config exports not an array of queries' +
		        ' or an object of envs'
		    )
		  },

		  loadStat: function loadStat(ctx, name, data) {
		    if (!ctx.dangerousExtend && !process.env.BROWSERSLIST_DANGEROUS_EXTEND) {
		      checkExtend(name);
		    }
		    var stats = commonjsRequire(require.resolve(
		      path.join(name, 'browserslist-stats.json'),
		      { paths: ['.'] }
		    ));
		    return normalizeStats(data, stats)
		  },

		  getStat: function getStat(opts, data) {
		    var stats;
		    if (opts.stats) {
		      stats = opts.stats;
		    } else if (process.env.BROWSERSLIST_STATS) {
		      stats = process.env.BROWSERSLIST_STATS;
		    } else if (opts.path && path.resolve && fs.existsSync) {
		      stats = eachParent(
		        opts.path,
		        function (dir) {
		          var file = path.join(dir, 'browserslist-stats.json');
		          return isFile(file) ? file : undefined
		        },
		        statCache
		      );
		    }
		    if (typeof stats === 'string') {
		      try {
		        stats = JSON.parse(fs.readFileSync(stats));
		      } catch (e) {
		        throw new BrowserslistError("Can't read " + stats)
		      }
		    }
		    return normalizeStats(data, stats)
		  },

		  loadConfig: function loadConfig(opts) {
		    if (process.env.BROWSERSLIST) {
		      return process.env.BROWSERSLIST
		    } else if (opts.config || process.env.BROWSERSLIST_CONFIG) {
		      var file = opts.config || process.env.BROWSERSLIST_CONFIG;
		      return pickEnv(parsePackageOrReadConfig(file), opts)
		    } else if (opts.path) {
		      return pickEnv(module.exports.findConfig(opts.path), opts)
		    } else {
		      return undefined
		    }
		  },

		  loadCountry: function loadCountry(usage, country, data) {
		    var code = country.replace(/[^\w-]/g, '');
		    if (!usage[code]) {
		      var compressed;
		      try {
		        compressed = commonjsRequire('caniuse-lite/data/regions/' + code + '.js');
		      } catch (e) {
		        throw new BrowserslistError('Unknown region name `' + code + '`.')
		      }
		      var usageData = region(compressed);
		      normalizeUsageData(usageData, data);
		      usage[country] = {};
		      for (var i in usageData) {
		        for (var j in usageData[i]) {
		          usage[country][i + ' ' + j] = usageData[i][j];
		        }
		      }
		    }
		  },

		  loadFeature: function loadFeature(features, name) {
		    name = name.replace(/[^\w-]/g, '');
		    if (features[name]) return
		    var compressed;
		    try {
		      compressed = commonjsRequire('caniuse-lite/data/features/' + name + '.js');
		    } catch (e) {
		      throw new BrowserslistError('Unknown feature name `' + name + '`.')
		    }
		    var stats = feature(compressed).stats;
		    features[name] = {};
		    for (var i in stats) {
		      features[name][i] = {};
		      for (var j in stats[i]) {
		        features[name][i][j] = stats[i][j];
		      }
		    }
		  },

		  parseConfig: function parseConfig(string) {
		    var result = { defaults: [] };
		    var sections = ['defaults'];

		    string
		      .toString()
		      .replace(/#[^\n]*/g, '')
		      .split(/\n|,/)
		      .map(function (line) {
		        return line.trim()
		      })
		      .filter(function (line) {
		        return line !== ''
		      })
		      .forEach(function (line) {
		        if (IS_SECTION.test(line)) {
		          sections = line.match(IS_SECTION)[1].trim().split(' ');
		          sections.forEach(function (section) {
		            if (result[section]) {
		              throw new BrowserslistError(
		                'Duplicate section ' + section + ' in Browserslist config'
		              )
		            }
		            result[section] = [];
		          });
		        } else {
		          sections.forEach(function (section) {
		            result[section].push(line);
		          });
		        }
		      });

		    return result
		  },

		  readConfig: function readConfig(file) {
		    if (!isFile(file)) {
		      throw new BrowserslistError("Can't read " + file + ' config')
		    }

		    return module.exports.parseConfig(fs.readFileSync(file))
		  },

		  findConfigFile: function findConfigFile(from) {
		    return eachParent(
		      from,
		      function (dir) {
		        var config = path.join(dir, 'browserslist');
		        var pkg = path.join(dir, 'package.json');
		        var rc = path.join(dir, '.browserslistrc');

		        var pkgBrowserslist;
		        if (isFile(pkg)) {
		          try {
		            pkgBrowserslist = parsePackage(pkg);
		          } catch (e) {
		            if (e.name === 'BrowserslistError') throw e
		            console.warn(
		              '[Browserslist] Could not parse ' + pkg + '. Ignoring it.'
		            );
		          }
		        }

		        if (isFile(config) && pkgBrowserslist) {
		          throw new BrowserslistError(
		            dir + ' contains both browserslist and package.json with browsers'
		          )
		        } else if (isFile(rc) && pkgBrowserslist) {
		          throw new BrowserslistError(
		            dir +
		              ' contains both .browserslistrc and package.json with browsers'
		          )
		        } else if (isFile(config) && isFile(rc)) {
		          throw new BrowserslistError(
		            dir + ' contains both .browserslistrc and browserslist'
		          )
		        } else if (isFile(config)) {
		          return config
		        } else if (isFile(rc)) {
		          return rc
		        } else if (pkgBrowserslist) {
		          return pkg
		        }
		      },
		      configPathCache
		    )
		  },

		  findConfig: function findConfig(from) {
		    var configFile = this.findConfigFile(from);

		    return configFile ? parsePackageOrReadConfig(configFile) : undefined
		  },

		  clearCaches: function clearCaches() {
		    dataTimeChecked = false;
		    statCache = {};
		    configPathCache = {};
		    parseConfigCache = {};

		    this.cache = {};
		  },

		  oldDataWarning: function oldDataWarning(agentsObj) {
		    if (dataTimeChecked) return
		    dataTimeChecked = true;
		    if (process.env.BROWSERSLIST_IGNORE_OLD_DATA) return

		    var latest = latestReleaseTime(agentsObj);
		    var monthsPassed = getMonthsPassed(latest);

		    if (latest !== 0 && monthsPassed >= 6) {
		      var months = monthsPassed + ' ' + (monthsPassed > 1 ? 'months' : 'month');
		      console.warn(
		        'Browserslist: browsers data (caniuse-lite) is ' +
		          months +
		          ' old. Please run:\n' +
		          '  npx update-browserslist-db@latest\n' +
		          '  Why you should do it regularly: ' +
		          'https://github.com/browserslist/update-db#readme'
		      );
		    }
		  },

		  currentNode: function currentNode() {
		    return 'node ' + process.versions.node
		  },

		  env: process.env
		}; 
	} (node));
	return node.exports;
}

var parse;
var hasRequiredParse;

function requireParse () {
	if (hasRequiredParse) return parse;
	hasRequiredParse = 1;
	var AND_REGEXP = /^\s+and\s+(.*)/i;
	var OR_REGEXP = /^(?:,\s*|\s+or\s+)(.*)/i;

	function flatten(array) {
	  if (!Array.isArray(array)) return [array]
	  return array.reduce(function (a, b) {
	    return a.concat(flatten(b))
	  }, [])
	}

	function find(string, predicate) {
	  for (var max = string.length, n = 1; n <= max; n++) {
	    var parsed = string.substr(-n, n);
	    if (predicate(parsed, n, max)) {
	      return string.slice(0, -n)
	    }
	  }
	  return ''
	}

	function matchQuery(all, query) {
	  var node = { query: query };
	  if (query.indexOf('not ') === 0) {
	    node.not = true;
	    query = query.slice(4);
	  }

	  for (var name in all) {
	    var type = all[name];
	    var match = query.match(type.regexp);
	    if (match) {
	      node.type = name;
	      for (var i = 0; i < type.matches.length; i++) {
	        node[type.matches[i]] = match[i + 1];
	      }
	      return node
	    }
	  }

	  node.type = 'unknown';
	  return node
	}

	function matchBlock(all, string, qs) {
	  var node;
	  return find(string, function (parsed, n, max) {
	    if (AND_REGEXP.test(parsed)) {
	      node = matchQuery(all, parsed.match(AND_REGEXP)[1]);
	      node.compose = 'and';
	      qs.unshift(node);
	      return true
	    } else if (OR_REGEXP.test(parsed)) {
	      node = matchQuery(all, parsed.match(OR_REGEXP)[1]);
	      node.compose = 'or';
	      qs.unshift(node);
	      return true
	    } else if (n === max) {
	      node = matchQuery(all, parsed.trim());
	      node.compose = 'or';
	      qs.unshift(node);
	      return true
	    }
	    return false
	  })
	}

	parse = function parse(all, queries) {
	  if (!Array.isArray(queries)) queries = [queries];
	  return flatten(
	    queries.map(function (block) {
	      var qs = [];
	      do {
	        block = matchBlock(all, block, qs);
	      } while (block)
	      return qs
	    })
	  )
	};
	return parse;
}

var browserslist_1;
var hasRequiredBrowserslist;

function requireBrowserslist () {
	if (hasRequiredBrowserslist) return browserslist_1;
	hasRequiredBrowserslist = 1;
	var jsReleases = require$$0;
	var agents = requireAgents().agents;
	var e2c = requireVersions();
	var jsEOL = require$$3;
	var path = require$$3$1;

	var BrowserslistError = requireError();
	var env = requireNode();
	var parseWithoutCache = requireParse(); // Will load browser.js in webpack

	var YEAR = 365.259641 * 24 * 60 * 60 * 1000;
	var ANDROID_EVERGREEN_FIRST = '37';
	var OP_MOB_BLINK_FIRST = 14;

	// Helpers

	function isVersionsMatch(versionA, versionB) {
	  return (versionA + '.').indexOf(versionB + '.') === 0
	}

	function isEolReleased(name) {
	  var version = name.slice(1);
	  return browserslist.nodeVersions.some(function (i) {
	    return isVersionsMatch(i, version)
	  })
	}

	function normalize(versions) {
	  return versions.filter(function (version) {
	    return typeof version === 'string'
	  })
	}

	function normalizeElectron(version) {
	  var versionToUse = version;
	  if (version.split('.').length === 3) {
	    versionToUse = version.split('.').slice(0, -1).join('.');
	  }
	  return versionToUse
	}

	function nameMapper(name) {
	  return function mapName(version) {
	    return name + ' ' + version
	  }
	}

	function getMajor(version) {
	  return parseInt(version.split('.')[0])
	}

	function getMajorVersions(released, number) {
	  if (released.length === 0) return []
	  var majorVersions = uniq(released.map(getMajor));
	  var minimum = majorVersions[majorVersions.length - number];
	  if (!minimum) {
	    return released
	  }
	  var selected = [];
	  for (var i = released.length - 1; i >= 0; i--) {
	    if (minimum > getMajor(released[i])) break
	    selected.unshift(released[i]);
	  }
	  return selected
	}

	function uniq(array) {
	  var filtered = [];
	  for (var i = 0; i < array.length; i++) {
	    if (filtered.indexOf(array[i]) === -1) filtered.push(array[i]);
	  }
	  return filtered
	}

	function fillUsage(result, name, data) {
	  for (var i in data) {
	    result[name + ' ' + i] = data[i];
	  }
	}

	function generateFilter(sign, version) {
	  version = parseFloat(version);
	  if (sign === '>') {
	    return function (v) {
	      return parseLatestFloat(v) > version
	    }
	  } else if (sign === '>=') {
	    return function (v) {
	      return parseLatestFloat(v) >= version
	    }
	  } else if (sign === '<') {
	    return function (v) {
	      return parseFloat(v) < version
	    }
	  } else {
	    return function (v) {
	      return parseFloat(v) <= version
	    }
	  }

	  function parseLatestFloat(v) {
	    return parseFloat(v.split('-')[1] || v)
	  }
	}

	function generateSemverFilter(sign, version) {
	  version = version.split('.').map(parseSimpleInt);
	  version[1] = version[1] || 0;
	  version[2] = version[2] || 0;
	  if (sign === '>') {
	    return function (v) {
	      v = v.split('.').map(parseSimpleInt);
	      return compareSemver(v, version) > 0
	    }
	  } else if (sign === '>=') {
	    return function (v) {
	      v = v.split('.').map(parseSimpleInt);
	      return compareSemver(v, version) >= 0
	    }
	  } else if (sign === '<') {
	    return function (v) {
	      v = v.split('.').map(parseSimpleInt);
	      return compareSemver(version, v) > 0
	    }
	  } else {
	    return function (v) {
	      v = v.split('.').map(parseSimpleInt);
	      return compareSemver(version, v) >= 0
	    }
	  }
	}

	function parseSimpleInt(x) {
	  return parseInt(x)
	}

	function compare(a, b) {
	  if (a < b) return -1
	  if (a > b) return 1
	  return 0
	}

	function compareSemver(a, b) {
	  return (
	    compare(parseInt(a[0]), parseInt(b[0])) ||
	    compare(parseInt(a[1] || '0'), parseInt(b[1] || '0')) ||
	    compare(parseInt(a[2] || '0'), parseInt(b[2] || '0'))
	  )
	}

	// this follows the npm-like semver behavior
	function semverFilterLoose(operator, range) {
	  range = range.split('.').map(parseSimpleInt);
	  if (typeof range[1] === 'undefined') {
	    range[1] = 'x';
	  }
	  // ignore any patch version because we only return minor versions
	  // range[2] = 'x'
	  switch (operator) {
	    case '<=':
	      return function (version) {
	        version = version.split('.').map(parseSimpleInt);
	        return compareSemverLoose(version, range) <= 0
	      }
	    case '>=':
	    default:
	      return function (version) {
	        version = version.split('.').map(parseSimpleInt);
	        return compareSemverLoose(version, range) >= 0
	      }
	  }
	}

	// this follows the npm-like semver behavior
	function compareSemverLoose(version, range) {
	  if (version[0] !== range[0]) {
	    return version[0] < range[0] ? -1 : 1
	  }
	  if (range[1] === 'x') {
	    return 0
	  }
	  if (version[1] !== range[1]) {
	    return version[1] < range[1] ? -1 : 1
	  }
	  return 0
	}

	function resolveVersion(data, version) {
	  if (data.versions.indexOf(version) !== -1) {
	    return version
	  } else if (browserslist.versionAliases[data.name][version]) {
	    return browserslist.versionAliases[data.name][version]
	  } else {
	    return false
	  }
	}

	function normalizeVersion(data, version) {
	  var resolved = resolveVersion(data, version);
	  if (resolved) {
	    return resolved
	  } else if (data.versions.length === 1) {
	    return data.versions[0]
	  } else {
	    return false
	  }
	}

	function filterByYear(since, context) {
	  since = since / 1000;
	  return Object.keys(agents).reduce(function (selected, name) {
	    var data = byName(name, context);
	    if (!data) return selected
	    var versions = Object.keys(data.releaseDate).filter(function (v) {
	      var date = data.releaseDate[v];
	      return date !== null && date >= since
	    });
	    return selected.concat(versions.map(nameMapper(data.name)))
	  }, [])
	}

	function cloneData(data) {
	  return {
	    name: data.name,
	    versions: data.versions,
	    released: data.released,
	    releaseDate: data.releaseDate
	  }
	}

	function byName(name, context) {
	  name = name.toLowerCase();
	  name = browserslist.aliases[name] || name;
	  if (context.mobileToDesktop && browserslist.desktopNames[name]) {
	    var desktop = browserslist.data[browserslist.desktopNames[name]];
	    if (name === 'android') {
	      return normalizeAndroidData(cloneData(browserslist.data[name]), desktop)
	    } else {
	      var cloned = cloneData(desktop);
	      cloned.name = name;
	      return cloned
	    }
	  }
	  return browserslist.data[name]
	}

	function normalizeAndroidVersions(androidVersions, chromeVersions) {
	  var iFirstEvergreen = chromeVersions.indexOf(ANDROID_EVERGREEN_FIRST);
	  return androidVersions
	    .filter(function (version) {
	      return /^(?:[2-4]\.|[34]$)/.test(version)
	    })
	    .concat(chromeVersions.slice(iFirstEvergreen))
	}

	function copyObject(obj) {
	  var copy = {};
	  for (var key in obj) {
	    copy[key] = obj[key];
	  }
	  return copy
	}

	function normalizeAndroidData(android, chrome) {
	  android.released = normalizeAndroidVersions(android.released, chrome.released);
	  android.versions = normalizeAndroidVersions(android.versions, chrome.versions);
	  android.releaseDate = copyObject(android.releaseDate);
	  android.released.forEach(function (v) {
	    if (android.releaseDate[v] === undefined) {
	      android.releaseDate[v] = chrome.releaseDate[v];
	    }
	  });
	  return android
	}

	function checkName(name, context) {
	  var data = byName(name, context);
	  if (!data) throw new BrowserslistError('Unknown browser ' + name)
	  return data
	}

	function unknownQuery(query) {
	  return new BrowserslistError(
	    'Unknown browser query `' +
	      query +
	      '`. ' +
	      'Maybe you are using old Browserslist or made typo in query.'
	  )
	}

	// Adjusts last X versions queries for some mobile browsers,
	// where caniuse data jumps from a legacy version to the latest
	function filterJumps(list, name, nVersions, context) {
	  var jump = 1;
	  switch (name) {
	    case 'android':
	      if (context.mobileToDesktop) return list
	      var released = browserslist.data.chrome.released;
	      jump = released.length - released.indexOf(ANDROID_EVERGREEN_FIRST);
	      break
	    case 'op_mob':
	      var latest = browserslist.data.op_mob.released.slice(-1)[0];
	      jump = getMajor(latest) - OP_MOB_BLINK_FIRST + 1;
	      break
	    default:
	      return list
	  }
	  if (nVersions <= jump) {
	    return list.slice(-1)
	  }
	  return list.slice(jump - 1 - nVersions)
	}

	function isSupported(flags, withPartial) {
	  return (
	    typeof flags === 'string' &&
	    (flags.indexOf('y') >= 0 || (withPartial && flags.indexOf('a') >= 0))
	  )
	}

	function resolve(queries, context) {
	  return parseQueries(queries).reduce(function (result, node, index) {
	    if (node.not && index === 0) {
	      throw new BrowserslistError(
	        'Write any browsers query (for instance, `defaults`) ' +
	          'before `' +
	          node.query +
	          '`'
	      )
	    }
	    var type = QUERIES[node.type];
	    var array = type.select.call(browserslist, context, node).map(function (j) {
	      var parts = j.split(' ');
	      if (parts[1] === '0') {
	        return parts[0] + ' ' + byName(parts[0], context).versions[0]
	      } else {
	        return j
	      }
	    });

	    if (node.compose === 'and') {
	      if (node.not) {
	        return result.filter(function (j) {
	          return array.indexOf(j) === -1
	        })
	      } else {
	        return result.filter(function (j) {
	          return array.indexOf(j) !== -1
	        })
	      }
	    } else {
	      if (node.not) {
	        var filter = {};
	        array.forEach(function (j) {
	          filter[j] = true;
	        });
	        return result.filter(function (j) {
	          return !filter[j]
	        })
	      }
	      return result.concat(array)
	    }
	  }, [])
	}

	function prepareOpts(opts) {
	  if (typeof opts === 'undefined') opts = {};

	  if (typeof opts.path === 'undefined') {
	    opts.path = path.resolve ? path.resolve('.') : '.';
	  }

	  return opts
	}

	function prepareQueries(queries, opts) {
	  if (typeof queries === 'undefined' || queries === null) {
	    var config = browserslist.loadConfig(opts);
	    if (config) {
	      queries = config;
	    } else {
	      queries = browserslist.defaults;
	    }
	  }

	  return queries
	}

	function checkQueries(queries) {
	  if (!(typeof queries === 'string' || Array.isArray(queries))) {
	    throw new BrowserslistError(
	      'Browser queries must be an array or string. Got ' + typeof queries + '.'
	    )
	  }
	}

	var cache = {};
	var parseCache = {};

	function browserslist(queries, opts) {
	  opts = prepareOpts(opts);
	  queries = prepareQueries(queries, opts);
	  checkQueries(queries);

	  var needsPath = parseQueries(queries).some(function (node) {
	    return QUERIES[node.type].needsPath
	  });
	  var context = {
	    ignoreUnknownVersions: opts.ignoreUnknownVersions,
	    dangerousExtend: opts.dangerousExtend,
	    mobileToDesktop: opts.mobileToDesktop,
	    env: opts.env
	  };
	  // Removing to avoid using context.path without marking query as needsPath
	  if (needsPath) {
	    context.path = opts.path;
	  }

	  env.oldDataWarning(browserslist.data);
	  var stats = env.getStat(opts, browserslist.data);
	  if (stats) {
	    context.customUsage = {};
	    for (var browser in stats) {
	      fillUsage(context.customUsage, browser, stats[browser]);
	    }
	  }

	  var cacheKey = JSON.stringify([queries, context]);
	  if (cache[cacheKey]) return cache[cacheKey]

	  var result = uniq(resolve(queries, context)).sort(function (name1, name2) {
	    name1 = name1.split(' ');
	    name2 = name2.split(' ');
	    if (name1[0] === name2[0]) {
	      // assumptions on caniuse data
	      // 1) version ranges never overlaps
	      // 2) if version is not a range, it never contains `-`
	      var version1 = name1[1].split('-')[0];
	      var version2 = name2[1].split('-')[0];
	      return compareSemver(version2.split('.'), version1.split('.'))
	    } else {
	      return compare(name1[0], name2[0])
	    }
	  });
	  if (!env.env.BROWSERSLIST_DISABLE_CACHE) {
	    cache[cacheKey] = result;
	  }
	  return result
	}

	function parseQueries(queries) {
	  var cacheKey = JSON.stringify(queries);
	  if (cacheKey in parseCache) return parseCache[cacheKey]
	  var result = parseWithoutCache(QUERIES, queries);
	  if (!env.env.BROWSERSLIST_DISABLE_CACHE) {
	    parseCache[cacheKey] = result;
	  }
	  return result
	}

	browserslist.parse = function (queries, opts) {
	  opts = prepareOpts(opts);
	  queries = prepareQueries(queries, opts);
	  checkQueries(queries);
	  return parseQueries(queries)
	};

	// Will be filled by Can I Use data below
	browserslist.cache = {};
	browserslist.data = {};
	browserslist.usage = {
	  global: {},
	  custom: null
	};

	// Default browsers query
	browserslist.defaults = ['> 0.5%', 'last 2 versions', 'Firefox ESR', 'not dead'];

	// Browser names aliases
	browserslist.aliases = {
	  fx: 'firefox',
	  ff: 'firefox',
	  ios: 'ios_saf',
	  explorer: 'ie',
	  blackberry: 'bb',
	  explorermobile: 'ie_mob',
	  operamini: 'op_mini',
	  operamobile: 'op_mob',
	  chromeandroid: 'and_chr',
	  firefoxandroid: 'and_ff',
	  ucandroid: 'and_uc',
	  qqandroid: 'and_qq'
	};

	// Can I Use only provides a few versions for some browsers (e.g. and_chr).
	// Fallback to a similar browser for unknown versions
	// Note op_mob is not included as its chromium versions are not in sync with Opera desktop
	browserslist.desktopNames = {
	  and_chr: 'chrome',
	  and_ff: 'firefox',
	  ie_mob: 'ie',
	  android: 'chrome' // has extra processing logic
	};

	// Aliases to work with joined versions like `ios_saf 7.0-7.1`
	browserslist.versionAliases = {};

	browserslist.clearCaches = env.clearCaches;
	browserslist.parseConfig = env.parseConfig;
	browserslist.readConfig = env.readConfig;
	browserslist.findConfigFile = env.findConfigFile;
	browserslist.findConfig = env.findConfig;
	browserslist.loadConfig = env.loadConfig;

	browserslist.coverage = function (browsers, stats) {
	  var data;
	  if (typeof stats === 'undefined') {
	    data = browserslist.usage.global;
	  } else if (stats === 'my stats') {
	    var opts = {};
	    opts.path = path.resolve ? path.resolve('.') : '.';
	    var customStats = env.getStat(opts);
	    if (!customStats) {
	      throw new BrowserslistError('Custom usage statistics was not provided')
	    }
	    data = {};
	    for (var browser in customStats) {
	      fillUsage(data, browser, customStats[browser]);
	    }
	  } else if (typeof stats === 'string') {
	    if (stats.length > 2) {
	      stats = stats.toLowerCase();
	    } else {
	      stats = stats.toUpperCase();
	    }
	    env.loadCountry(browserslist.usage, stats, browserslist.data);
	    data = browserslist.usage[stats];
	  } else {
	    if ('dataByBrowser' in stats) {
	      stats = stats.dataByBrowser;
	    }
	    data = {};
	    for (var name in stats) {
	      for (var version in stats[name]) {
	        data[name + ' ' + version] = stats[name][version];
	      }
	    }
	  }

	  return browsers.reduce(function (all, i) {
	    var usage = data[i];
	    if (usage === undefined) {
	      usage = data[i.replace(/ \S+$/, ' 0')];
	    }
	    return all + (usage || 0)
	  }, 0)
	};

	function nodeQuery(context, node) {
	  var matched = browserslist.nodeVersions.filter(function (i) {
	    return isVersionsMatch(i, node.version)
	  });
	  if (matched.length === 0) {
	    if (context.ignoreUnknownVersions) {
	      return []
	    } else {
	      throw new BrowserslistError(
	        'Unknown version ' + node.version + ' of Node.js'
	      )
	    }
	  }
	  return ['node ' + matched[matched.length - 1]]
	}

	function sinceQuery(context, node) {
	  var year = parseInt(node.year);
	  var month = parseInt(node.month || '01') - 1;
	  var day = parseInt(node.day || '01');
	  return filterByYear(Date.UTC(year, month, day, 0, 0, 0), context)
	}

	function coverQuery(context, node) {
	  var coverage = parseFloat(node.coverage);
	  var usage = browserslist.usage.global;
	  if (node.place) {
	    if (node.place.match(/^my\s+stats$/i)) {
	      if (!context.customUsage) {
	        throw new BrowserslistError('Custom usage statistics was not provided')
	      }
	      usage = context.customUsage;
	    } else {
	      var place;
	      if (node.place.length === 2) {
	        place = node.place.toUpperCase();
	      } else {
	        place = node.place.toLowerCase();
	      }
	      env.loadCountry(browserslist.usage, place, browserslist.data);
	      usage = browserslist.usage[place];
	    }
	  }
	  var versions = Object.keys(usage).sort(function (a, b) {
	    return usage[b] - usage[a]
	  });
	  var coveraged = 0;
	  var result = [];
	  var version;
	  for (var i = 0; i < versions.length; i++) {
	    version = versions[i];
	    if (usage[version] === 0) break
	    coveraged += usage[version];
	    result.push(version);
	    if (coveraged >= coverage) break
	  }
	  return result
	}

	var QUERIES = {
	  last_major_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+major\s+versions?$/i,
	    select: function (context, node) {
	      return Object.keys(agents).reduce(function (selected, name) {
	        var data = byName(name, context);
	        if (!data) return selected
	        var list = getMajorVersions(data.released, node.versions);
	        list = list.map(nameMapper(data.name));
	        list = filterJumps(list, data.name, node.versions, context);
	        return selected.concat(list)
	      }, [])
	    }
	  },
	  last_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+versions?$/i,
	    select: function (context, node) {
	      return Object.keys(agents).reduce(function (selected, name) {
	        var data = byName(name, context);
	        if (!data) return selected
	        var list = data.released.slice(-node.versions);
	        list = list.map(nameMapper(data.name));
	        list = filterJumps(list, data.name, node.versions, context);
	        return selected.concat(list)
	      }, [])
	    }
	  },
	  last_electron_major_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+electron\s+major\s+versions?$/i,
	    select: function (context, node) {
	      var validVersions = getMajorVersions(Object.keys(e2c), node.versions);
	      return validVersions.map(function (i) {
	        return 'chrome ' + e2c[i]
	      })
	    }
	  },
	  last_node_major_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+node\s+major\s+versions?$/i,
	    select: function (context, node) {
	      return getMajorVersions(browserslist.nodeVersions, node.versions).map(
	        function (version) {
	          return 'node ' + version
	        }
	      )
	    }
	  },
	  last_browser_major_versions: {
	    matches: ['versions', 'browser'],
	    regexp: /^last\s+(\d+)\s+(\w+)\s+major\s+versions?$/i,
	    select: function (context, node) {
	      var data = checkName(node.browser, context);
	      var validVersions = getMajorVersions(data.released, node.versions);
	      var list = validVersions.map(nameMapper(data.name));
	      list = filterJumps(list, data.name, node.versions, context);
	      return list
	    }
	  },
	  last_electron_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+electron\s+versions?$/i,
	    select: function (context, node) {
	      return Object.keys(e2c)
	        .slice(-node.versions)
	        .map(function (i) {
	          return 'chrome ' + e2c[i]
	        })
	    }
	  },
	  last_node_versions: {
	    matches: ['versions'],
	    regexp: /^last\s+(\d+)\s+node\s+versions?$/i,
	    select: function (context, node) {
	      return browserslist.nodeVersions
	        .slice(-node.versions)
	        .map(function (version) {
	          return 'node ' + version
	        })
	    }
	  },
	  last_browser_versions: {
	    matches: ['versions', 'browser'],
	    regexp: /^last\s+(\d+)\s+(\w+)\s+versions?$/i,
	    select: function (context, node) {
	      var data = checkName(node.browser, context);
	      var list = data.released.slice(-node.versions).map(nameMapper(data.name));
	      list = filterJumps(list, data.name, node.versions, context);
	      return list
	    }
	  },
	  unreleased_versions: {
	    matches: [],
	    regexp: /^unreleased\s+versions$/i,
	    select: function (context) {
	      return Object.keys(agents).reduce(function (selected, name) {
	        var data = byName(name, context);
	        if (!data) return selected
	        var list = data.versions.filter(function (v) {
	          return data.released.indexOf(v) === -1
	        });
	        list = list.map(nameMapper(data.name));
	        return selected.concat(list)
	      }, [])
	    }
	  },
	  unreleased_electron_versions: {
	    matches: [],
	    regexp: /^unreleased\s+electron\s+versions?$/i,
	    select: function () {
	      return []
	    }
	  },
	  unreleased_browser_versions: {
	    matches: ['browser'],
	    regexp: /^unreleased\s+(\w+)\s+versions?$/i,
	    select: function (context, node) {
	      var data = checkName(node.browser, context);
	      return data.versions
	        .filter(function (v) {
	          return data.released.indexOf(v) === -1
	        })
	        .map(nameMapper(data.name))
	    }
	  },
	  last_years: {
	    matches: ['years'],
	    regexp: /^last\s+(\d*.?\d+)\s+years?$/i,
	    select: function (context, node) {
	      return filterByYear(Date.now() - YEAR * node.years, context)
	    }
	  },
	  since_y: {
	    matches: ['year'],
	    regexp: /^since (\d+)$/i,
	    select: sinceQuery
	  },
	  since_y_m: {
	    matches: ['year', 'month'],
	    regexp: /^since (\d+)-(\d+)$/i,
	    select: sinceQuery
	  },
	  since_y_m_d: {
	    matches: ['year', 'month', 'day'],
	    regexp: /^since (\d+)-(\d+)-(\d+)$/i,
	    select: sinceQuery
	  },
	  popularity: {
	    matches: ['sign', 'popularity'],
	    regexp: /^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%$/,
	    select: function (context, node) {
	      var popularity = parseFloat(node.popularity);
	      var usage = browserslist.usage.global;
	      return Object.keys(usage).reduce(function (result, version) {
	        if (node.sign === '>') {
	          if (usage[version] > popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<') {
	          if (usage[version] < popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<=') {
	          if (usage[version] <= popularity) {
	            result.push(version);
	          }
	        } else if (usage[version] >= popularity) {
	          result.push(version);
	        }
	        return result
	      }, [])
	    }
	  },
	  popularity_in_my_stats: {
	    matches: ['sign', 'popularity'],
	    regexp: /^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+my\s+stats$/,
	    select: function (context, node) {
	      var popularity = parseFloat(node.popularity);
	      if (!context.customUsage) {
	        throw new BrowserslistError('Custom usage statistics was not provided')
	      }
	      var usage = context.customUsage;
	      return Object.keys(usage).reduce(function (result, version) {
	        var percentage = usage[version];
	        if (percentage == null) {
	          return result
	        }

	        if (node.sign === '>') {
	          if (percentage > popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<') {
	          if (percentage < popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<=') {
	          if (percentage <= popularity) {
	            result.push(version);
	          }
	        } else if (percentage >= popularity) {
	          result.push(version);
	        }
	        return result
	      }, [])
	    }
	  },
	  popularity_in_config_stats: {
	    matches: ['sign', 'popularity', 'config'],
	    regexp: /^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+(\S+)\s+stats$/,
	    select: function (context, node) {
	      var popularity = parseFloat(node.popularity);
	      var stats = env.loadStat(context, node.config, browserslist.data);
	      if (stats) {
	        context.customUsage = {};
	        for (var browser in stats) {
	          fillUsage(context.customUsage, browser, stats[browser]);
	        }
	      }
	      if (!context.customUsage) {
	        throw new BrowserslistError('Custom usage statistics was not provided')
	      }
	      var usage = context.customUsage;
	      return Object.keys(usage).reduce(function (result, version) {
	        var percentage = usage[version];
	        if (percentage == null) {
	          return result
	        }

	        if (node.sign === '>') {
	          if (percentage > popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<') {
	          if (percentage < popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<=') {
	          if (percentage <= popularity) {
	            result.push(version);
	          }
	        } else if (percentage >= popularity) {
	          result.push(version);
	        }
	        return result
	      }, [])
	    }
	  },
	  popularity_in_place: {
	    matches: ['sign', 'popularity', 'place'],
	    regexp: /^(>=?|<=?)\s*(\d+|\d+\.\d+|\.\d+)%\s+in\s+((alt-)?\w\w)$/,
	    select: function (context, node) {
	      var popularity = parseFloat(node.popularity);
	      var place = node.place;
	      if (place.length === 2) {
	        place = place.toUpperCase();
	      } else {
	        place = place.toLowerCase();
	      }
	      env.loadCountry(browserslist.usage, place, browserslist.data);
	      var usage = browserslist.usage[place];
	      return Object.keys(usage).reduce(function (result, version) {
	        var percentage = usage[version];
	        if (percentage == null) {
	          return result
	        }

	        if (node.sign === '>') {
	          if (percentage > popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<') {
	          if (percentage < popularity) {
	            result.push(version);
	          }
	        } else if (node.sign === '<=') {
	          if (percentage <= popularity) {
	            result.push(version);
	          }
	        } else if (percentage >= popularity) {
	          result.push(version);
	        }
	        return result
	      }, [])
	    }
	  },
	  cover: {
	    matches: ['coverage'],
	    regexp: /^cover\s+(\d+|\d+\.\d+|\.\d+)%$/i,
	    select: coverQuery
	  },
	  cover_in: {
	    matches: ['coverage', 'place'],
	    regexp: /^cover\s+(\d+|\d+\.\d+|\.\d+)%\s+in\s+(my\s+stats|(alt-)?\w\w)$/i,
	    select: coverQuery
	  },
	  supports: {
	    matches: ['supportType', 'feature'],
	    regexp: /^(?:(fully|partially)\s+)?supports\s+([\w-]+)$/,
	    select: function (context, node) {
	      env.loadFeature(browserslist.cache, node.feature);
	      var withPartial = node.supportType !== 'fully';
	      var features = browserslist.cache[node.feature];
	      var result = [];
	      for (var name in features) {
	        var data = byName(name, context);
	        // Only check desktop when latest released mobile has support
	        var iMax = data.released.length - 1;
	        while (iMax >= 0) {
	          if (data.released[iMax] in features[name]) break
	          iMax--;
	        }
	        var checkDesktop =
	          context.mobileToDesktop &&
	          name in browserslist.desktopNames &&
	          isSupported(features[name][data.released[iMax]], withPartial);
	        data.versions.forEach(function (version) {
	          var flags = features[name][version];
	          if (flags === undefined && checkDesktop) {
	            flags = features[browserslist.desktopNames[name]][version];
	          }
	          if (isSupported(flags, withPartial)) {
	            result.push(name + ' ' + version);
	          }
	        });
	      }
	      return result
	    }
	  },
	  electron_range: {
	    matches: ['from', 'to'],
	    regexp: /^electron\s+([\d.]+)\s*-\s*([\d.]+)$/i,
	    select: function (context, node) {
	      var fromToUse = normalizeElectron(node.from);
	      var toToUse = normalizeElectron(node.to);
	      var from = parseFloat(node.from);
	      var to = parseFloat(node.to);
	      if (!e2c[fromToUse]) {
	        throw new BrowserslistError('Unknown version ' + from + ' of electron')
	      }
	      if (!e2c[toToUse]) {
	        throw new BrowserslistError('Unknown version ' + to + ' of electron')
	      }
	      return Object.keys(e2c)
	        .filter(function (i) {
	          var parsed = parseFloat(i);
	          return parsed >= from && parsed <= to
	        })
	        .map(function (i) {
	          return 'chrome ' + e2c[i]
	        })
	    }
	  },
	  node_range: {
	    matches: ['from', 'to'],
	    regexp: /^node\s+([\d.]+)\s*-\s*([\d.]+)$/i,
	    select: function (context, node) {
	      return browserslist.nodeVersions
	        .filter(semverFilterLoose('>=', node.from))
	        .filter(semverFilterLoose('<=', node.to))
	        .map(function (v) {
	          return 'node ' + v
	        })
	    }
	  },
	  browser_range: {
	    matches: ['browser', 'from', 'to'],
	    regexp: /^(\w+)\s+([\d.]+)\s*-\s*([\d.]+)$/i,
	    select: function (context, node) {
	      var data = checkName(node.browser, context);
	      var from = parseFloat(normalizeVersion(data, node.from) || node.from);
	      var to = parseFloat(normalizeVersion(data, node.to) || node.to);
	      function filter(v) {
	        var parsed = parseFloat(v);
	        return parsed >= from && parsed <= to
	      }
	      return data.released.filter(filter).map(nameMapper(data.name))
	    }
	  },
	  electron_ray: {
	    matches: ['sign', 'version'],
	    regexp: /^electron\s*(>=?|<=?)\s*([\d.]+)$/i,
	    select: function (context, node) {
	      var versionToUse = normalizeElectron(node.version);
	      return Object.keys(e2c)
	        .filter(generateFilter(node.sign, versionToUse))
	        .map(function (i) {
	          return 'chrome ' + e2c[i]
	        })
	    }
	  },
	  node_ray: {
	    matches: ['sign', 'version'],
	    regexp: /^node\s*(>=?|<=?)\s*([\d.]+)$/i,
	    select: function (context, node) {
	      return browserslist.nodeVersions
	        .filter(generateSemverFilter(node.sign, node.version))
	        .map(function (v) {
	          return 'node ' + v
	        })
	    }
	  },
	  browser_ray: {
	    matches: ['browser', 'sign', 'version'],
	    regexp: /^(\w+)\s*(>=?|<=?)\s*([\d.]+)$/,
	    select: function (context, node) {
	      var version = node.version;
	      var data = checkName(node.browser, context);
	      var alias = browserslist.versionAliases[data.name][version];
	      if (alias) version = alias;
	      return data.released
	        .filter(generateFilter(node.sign, version))
	        .map(function (v) {
	          return data.name + ' ' + v
	        })
	    }
	  },
	  firefox_esr: {
	    matches: [],
	    regexp: /^(firefox|ff|fx)\s+esr$/i,
	    select: function () {
	      return ['firefox 128']
	    }
	  },
	  opera_mini_all: {
	    matches: [],
	    regexp: /(operamini|op_mini)\s+all/i,
	    select: function () {
	      return ['op_mini all']
	    }
	  },
	  electron_version: {
	    matches: ['version'],
	    regexp: /^electron\s+([\d.]+)$/i,
	    select: function (context, node) {
	      var versionToUse = normalizeElectron(node.version);
	      var chrome = e2c[versionToUse];
	      if (!chrome) {
	        throw new BrowserslistError(
	          'Unknown version ' + node.version + ' of electron'
	        )
	      }
	      return ['chrome ' + chrome]
	    }
	  },
	  node_major_version: {
	    matches: ['version'],
	    regexp: /^node\s+(\d+)$/i,
	    select: nodeQuery
	  },
	  node_minor_version: {
	    matches: ['version'],
	    regexp: /^node\s+(\d+\.\d+)$/i,
	    select: nodeQuery
	  },
	  node_patch_version: {
	    matches: ['version'],
	    regexp: /^node\s+(\d+\.\d+\.\d+)$/i,
	    select: nodeQuery
	  },
	  current_node: {
	    matches: [],
	    regexp: /^current\s+node$/i,
	    select: function (context) {
	      return [env.currentNode(resolve, context)]
	    }
	  },
	  maintained_node: {
	    matches: [],
	    regexp: /^maintained\s+node\s+versions$/i,
	    select: function (context) {
	      var now = Date.now();
	      var queries = Object.keys(jsEOL)
	        .filter(function (key) {
	          return (
	            now < Date.parse(jsEOL[key].end) &&
	            now > Date.parse(jsEOL[key].start) &&
	            isEolReleased(key)
	          )
	        })
	        .map(function (key) {
	          return 'node ' + key.slice(1)
	        });
	      return resolve(queries, context)
	    }
	  },
	  phantomjs_1_9: {
	    matches: [],
	    regexp: /^phantomjs\s+1.9$/i,
	    select: function () {
	      return ['safari 5']
	    }
	  },
	  phantomjs_2_1: {
	    matches: [],
	    regexp: /^phantomjs\s+2.1$/i,
	    select: function () {
	      return ['safari 6']
	    }
	  },
	  browser_version: {
	    matches: ['browser', 'version'],
	    regexp: /^(\w+)\s+(tp|[\d.]+)$/i,
	    select: function (context, node) {
	      var version = node.version;
	      if (/^tp$/i.test(version)) version = 'TP';
	      var data = checkName(node.browser, context);
	      var alias = normalizeVersion(data, version);
	      if (alias) {
	        version = alias;
	      } else {
	        if (version.indexOf('.') === -1) {
	          alias = version + '.0';
	        } else {
	          alias = version.replace(/\.0$/, '');
	        }
	        alias = normalizeVersion(data, alias);
	        if (alias) {
	          version = alias;
	        } else if (context.ignoreUnknownVersions) {
	          return []
	        } else {
	          throw new BrowserslistError(
	            'Unknown version ' + version + ' of ' + node.browser
	          )
	        }
	      }
	      return [data.name + ' ' + version]
	    }
	  },
	  browserslist_config: {
	    matches: [],
	    regexp: /^browserslist config$/i,
	    needsPath: true,
	    select: function (context) {
	      return browserslist(undefined, context)
	    }
	  },
	  extends: {
	    matches: ['config'],
	    regexp: /^extends (.+)$/i,
	    needsPath: true,
	    select: function (context, node) {
	      return resolve(env.loadQueries(context, node.config), context)
	    }
	  },
	  defaults: {
	    matches: [],
	    regexp: /^defaults$/i,
	    select: function (context) {
	      return resolve(browserslist.defaults, context)
	    }
	  },
	  dead: {
	    matches: [],
	    regexp: /^dead$/i,
	    select: function (context) {
	      var dead = [
	        'Baidu >= 0',
	        'ie <= 11',
	        'ie_mob <= 11',
	        'bb <= 10',
	        'op_mob <= 12.1',
	        'samsung 4'
	      ];
	      return resolve(dead, context)
	    }
	  },
	  unknown: {
	    matches: [],
	    regexp: /^(\w+)$/i,
	    select: function (context, node) {
	      if (byName(node.query, context)) {
	        throw new BrowserslistError(
	          'Specify versions in Browserslist query for browser ' + node.query
	        )
	      } else {
	        throw unknownQuery(node.query)
	      }
	    }
	  }
	}

	// Get and convert Can I Use data

	;(function () {
	  for (var name in agents) {
	    var browser = agents[name];
	    browserslist.data[name] = {
	      name: name,
	      versions: normalize(agents[name].versions),
	      released: normalize(agents[name].versions.slice(0, -3)),
	      releaseDate: agents[name].release_date
	    };
	    fillUsage(browserslist.usage.global, name, browser.usage_global);

	    browserslist.versionAliases[name] = {};
	    for (var i = 0; i < browser.versions.length; i++) {
	      var full = browser.versions[i];
	      if (!full) continue

	      if (full.indexOf('-') !== -1) {
	        var interval = full.split('-');
	        for (var j = 0; j < interval.length; j++) {
	          browserslist.versionAliases[name][interval[j]] = full;
	        }
	      }
	    }
	  }

	  browserslist.nodeVersions = jsReleases.map(function (release) {
	    return release.version
	  });
	})();

	browserslist_1 = browserslist;
	return browserslist_1;
}

var browserslistExports = requireBrowserslist();
var __jsenv_default_import__ = /*@__PURE__*/getDefaultExportFromCjs(browserslistExports);

export { __jsenv_default_import__ as default };
