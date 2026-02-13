import { getAnswer } from "/packages/foo/foo.js?package_bundle&v=0.0.1";

const answer = getAnswer();
window.resolveResultPromise(answer);
document.querySelector("#app").innerHTML = answer;
