// there is a deliberate typo: "answerr" with 2 r instead of "answer"
/* eslint-disable import/named */
// above 1
// above 2
// above 3
/* before */ import { answerr } from "./foo.js"; /* after */
// below 1
// below 2
// below 3
/* eslint-enable import/named */

console.log(answerr);
