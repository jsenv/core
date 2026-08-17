import { getAnswer } from "/packages/foo/foo.js?package_bundle";

const answer = getAnswer();
window.resolveResultPromise(answer);
document.querySelector("#app").innerHTML = answer;
