import { answer } from "foo";

document.querySelector("#app").innerHTML = answer;
window.resolveResultPromise(answer);
