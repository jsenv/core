window.executionOrder.push("before_import_a");

// eslint-disable-next-line import/first
import { answer } from "/js/a.js";

window.executionOrder.push("after_import_a");

console.log(answer);
