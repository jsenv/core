// bar is imported before foo on purpose: a file depends on one package.json per
// package it imports, and foo's version must be tracked even though bar's was
// seen first. Keep this order.
// eslint-disable-next-line import-x/no-unresolved
import { label } from "bar";
// eslint-disable-next-line import-x/no-unresolved
import { answer } from "foo";

document.querySelector("#app").innerHTML = answer;
window.answer = answer;
window.label = label;
