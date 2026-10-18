// eslint-disable-next-line import-x/no-unresolved -- the test installs it
import { answer } from "foo";

document.querySelector("#app").innerHTML = answer;
window.answer = answer;
