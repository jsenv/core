import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("url", {
  // ["url port"]: () => {
  //   assert({
  //     actual: "http://example.com",
  //     expect: "http://example.com:8000",
  //   });
  // },
  // ["url search param modified"]: () => {
  //   assert({
  //     actual: new URL("http://example.com?foo=a"),
  //     expect: new URL("http://example.com?foo=b"),
  //   });
  // },
  // ["url search param modified, middle of long params"]: () => {
  //   assert({
  //     actual: "http://example_that_is_long.com?this_is_relatively_long=1&foo=a",
  //     expect: "http://example_that_is_long.com?this_is_relatively_long=1&foo=b",
  //     maxColumns: 30,
  //   });
  // },
  // ["url search param + vs space"]: () => {
  //   assert({
  //     actual: {
  //       a: `http://example.com?a=+&b=1`,
  //       b: true,
  //     },
  //     expect: {
  //       a: `http://example.com?a= &b=1`,
  //       b: false,
  //     },
  //   });
  // },
  // ["url search param quotes"]: () => {
  //   assert({
  //     actual: {
  //       a: `http://example.com?name="dam"`,
  //       b: true,
  //     },
  //     expect: {
  //       a: `http://example.com?name="seb"`,
  //       b: false,
  //     },
  //   });
  // },
  // ["url search param added"]: () => {
  //   assert({
  //     actual: new URL("http://example.com?foo=a"),
  //     expect: new URL("http://example.com"),
  //   });
  // },
  // ["url search param added 2"]: () => {
  //   assert({
  //     actual: new URL("http://example.com?foo=a&bar=b"),
  //     expect: new URL("http://example.com?foo=a"),
  //   });
  // },
  // ["url search param removed"]: () => {
  //   assert({
  //     actual: new URL("http://example.com"),
  //     expect: new URL("http://example.com?foo=a"),
  //   });
  // },
  // ["url search param removed 2"]: () => {
  //   assert({
  //     actual: new URL("http://example.com?foo=a"),
  //     expect: new URL("http://example.com?foo=a&bar=b"),
  //   });
  // },
  // ["multi search param 2nd value modified"]: () => {
  //   assert({
  //     actual: "http://example.com?foo=a&foo=b&foo=a",
  //     expect: "http://example.com?foo=a&foo=a&foo=a",
  //   });
  // },
  // ["adding multi search"]: () => {
  //   assert({
  //     actual: "http://example.com?foo=a&foo=b",
  //     expect: "http://example.com?foo=a",
  //   });
  // },
  // ["multi search adding a 3rd param"]: () => {
  //   assert({
  //     actual: "http://example.com?foo=a&foo=a&foo=a",
  //     expect: "http://example.com?foo=a&foo=a",
  //   });
  // },
  // ["multi search removing a 3rd param"]: () => {
  //   assert({
  //     actual: "http://example.com?foo=a&foo=a",
  //     expect: "http://example.com?foo=a&foo=a&foo=a",
  //   });
  // },
  // ["removing multi search"]: () => {
  //   assert({
  //     actual: "http://example.com?foo=a",
  //     expect: "http://example.com?foo=a&foo=b",
  //   });
  // },
  // ["url hash modified"]: () => {
  //   assert({
  //     actual: new URL("http://example.com#foo"),
  //     expect: new URL("http://example.com#bar"),
  //   });
  // },
  // ["url hash removed"]: () => {
  //   assert({
  //     actual: new URL("http://example.com"),
  //     expect: new URL("http://example.com#bar"),
  //   });
  // },
  // ["url string and url"]: () => {
  //   assert({
  //     actual: "http://example.com",
  //     expect: new URL("http://example.com:8000"),
  //   });
  // },
  // ["long url diff at end"]: () => {
  //   assert({
  //     actual: "http://example_that_is_quite_long.com/dir/file.txt",
  //     expect: "http://example_that_is_quite_long.com/dir/file.css",
  //     maxColumns: 40,
  //   });
  // },
  // ["long url diff at start"]: () => {
  //   assert({
  //     actual: "http://example_that_is_quite_long.com/dir/file.txt",
  //     expect: "file://example_that_is_quite_long.com/dir/file.txt",
  //     maxColumns: 40,
  //   });
  // },
  // ["long url diff in the middle"]: () => {
  //   assert({
  //     actual: "http://example_that_is_quite_long.com/dir/file.txt",
  //     expect: "http://example_that_AA_quite_long.com/dir/file.txt",
  //     maxColumns: 40,
  //   });
  // },
  // ["long url diff start middle end"]: () => {
  //   assert({
  //     actual: "http://example_that_is_quite_long.com/dir/file.txt",
  //     expect: "file://example_that_AA_quite_long.com/dir/file.css",
  //     maxColumns: 40,
  //   });
  // },
  // ["url and url string"]: () => {
  //   assert({
  //     actual: new URL("http://example.com"),
  //     expect: "http://example.com:8000",
  //   });
  // },
  // ["url string and url string"]: () => {
  //   assert({
  //     actual: "http://example.com",
  //     expect: "http://example.com:8000",
  //   });
  // },
  // ["url and non url string"]: () => {
  //   assert({
  //     actual: new URL("http://example.com"),
  //     expect: "totoabcexample.com",
  //   });
  // },
  // ["non url string and url"]: () => {
  //   assert({
  //     actual: "totoabcexample.com",
  //     expect: new URL("http://example.com"),
  //   });
  // },
  // ["url and boolean"]: () => {
  //   assert({
  //     actual: new URL("http://example.com"),
  //     expect: true,
  //   });
  // },
  // ["url string inside a prop"]: () => {
  //   assert({
  //     actual: {
  //       a: "http://example.com",
  //       b: true,
  //     },
  //     expect: {
  //       a: "http://example.com",
  //       b: false,
  //     },
  //   });
  // },
  // ["url string and object with href"]: () => {
  //   assert({
  //     actual: "http://example.com",
  //     expect: {
  //       href: "http://example.com",
  //     },
  //   });
  // },
  // ["url object port and object with port"]: () => {
  //   assert({
  //     actual: new URL("http://example.com:45"),
  //     expect: {
  //       port: 45,
  //     },
  //   });
  // },
  // ["file protocol vs http protocol"]: () => {
  //   assert({
  //     actual: "http://example/file.txt",
  //     expect: "file://example/file.js",
  //   });
  // },
  // ["quote test"]: () => {
  //   assert({
  //     actual: "http://example.com",
  //     expect: `test"quotes`,
  //   });
  // },
  // ["double quote in url string"]: () => {
  //   assert({
  //     actual: `http://a.com"`,
  //     expect: `http://b.com"`,
  //   });
  // },
  // ["url origin is case insensitive"]: () => {
  //   assert({
  //     actual: {
  //       a: `http://example.com/page`,
  //       b: true,
  //     },
  //     expect: {
  //       a: `HTTP://EXAMPLE.COM/PAGE`,
  //       b: false,
  //     },
  //   });
  // },
  // ["internal string vs url object"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => "toto",
  //     },
  //     expect: new URL("http://toto.com"),
  //   });
  // },
  // ["internal url string vs url string"]: () => {
  //   assert({
  //     actual: {
  //       [Symbol.toStringTag]: "Signal",
  //       valueOf: () => "http://a.com/",
  //     },
  //     expect: "http://b.com",
  //   });
  // },
});
