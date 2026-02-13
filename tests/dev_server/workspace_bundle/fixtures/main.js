import { getAnswer } from "foo";

const answer = getAnswer();
window.resolveResultPromise(answer);
document.querySelector("#app").innerHTML = answer;
