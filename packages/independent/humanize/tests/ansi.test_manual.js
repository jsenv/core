import { ANSI } from "@jsenv/humanize";

const abcUnderlined = ANSI.effect("abc", ANSI.UNDERLINE);
const abcColored = ANSI.color(abcUnderlined, ANSI.GREEN);

console.log(`before${abcColored}after`);

const spaceUnderlined = ANSI.effect(" ", ANSI.UNDERLINE);
console.log(`a${spaceUnderlined}b`);
