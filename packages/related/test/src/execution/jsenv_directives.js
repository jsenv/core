/*
 * Reads what a test file declares about its own execution, from the directive
 * prologue — the string literals a module may open with, as in "use strict" or
 * "use client":
 *
 *   "jsenv:allocate 90s";
 *   "jsenv:lock service-worker";
 *
 * They are read without running the file, which is what allows a lock to be
 * honored: an execution must not have started before we know what it takes.
 * Being grammar rather than convention, a directive cannot be built at runtime
 * and cannot move: it is the first statement or it is nothing.
 *
 * A "jsenv:" directive that cannot be read throws. Everything ignores an
 * unknown directive silently, so a typo would silently give the file back the
 * default budget; the only way it stays useful is to be loud.
 */

import { createDetailedMessage } from "@jsenv/humanize";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIRECTIVE_PREFIX = "jsenv:";
const DIRECTIVE_NAMES = `"jsenv:allocate <duration>", "jsenv:lock <resource>"`;
const DURATION_REGEX = /^(\d+)(ms|s|m)$/;
const MS_PER_UNIT = { ms: 1, s: 1_000, m: 60_000 };
// a directive prologue sits at the top of the file; comments can precede it but
// rarely for more than a few lines, and the whole file is read when they do
const HEAD_BYTE_COUNT = 4096;

export const readJsenvDirectives = (fileUrl) => {
  const head = readHead(fileUrl);
  let scanResult = scanDirectivePrologue(head.text);
  if (head.partial && !scanResult.complete) {
    scanResult = scanDirectivePrologue(readFileSync(new URL(fileUrl), "utf8"));
  }

  let allocatedMs;
  const lockArray = [];
  for (const directiveText of scanResult.directiveTextArray) {
    if (!directiveText.startsWith(DIRECTIVE_PREFIX)) {
      continue;
    }
    const body = directiveText.slice(DIRECTIVE_PREFIX.length);
    const spaceIndex = body.indexOf(" ");
    const name = spaceIndex === -1 ? body : body.slice(0, spaceIndex);
    const argument = spaceIndex === -1 ? "" : body.slice(spaceIndex + 1).trim();
    const fail = (reason, details = {}) => {
      throw new Error(
        createDetailedMessage(reason, {
          directive: `"${directiveText}"`,
          file: fileURLToPath(fileUrl),
          ...details,
        }),
      );
    };

    if (name === "allocate") {
      const match = DURATION_REGEX.exec(argument);
      if (!match) {
        fail(`"jsenv:allocate" expects a duration, got "${argument}"`, {
          ["durations accepted"]: `"500ms", "90s", "2m"`,
        });
      }
      allocatedMs = Number(match[1]) * MS_PER_UNIT[match[2]];
      continue;
    }
    if (name === "lock") {
      if (argument === "") {
        fail(`"jsenv:lock" expects the name of a resource`);
      }
      lockArray.push(argument);
      continue;
    }
    fail(`unknown jsenv directive "${name}"`, {
      ["directives available"]: DIRECTIVE_NAMES,
    });
  }
  return { allocatedMs, lockArray };
};

const readHead = (fileUrl) => {
  const fileDescriptor = openSync(fileURLToPath(fileUrl), "r");
  try {
    const buffer = Buffer.allocUnsafe(HEAD_BYTE_COUNT);
    const byteCount = readSync(fileDescriptor, buffer, 0, HEAD_BYTE_COUNT, 0);
    return {
      text: buffer.toString("utf8", 0, byteCount),
      partial: byteCount === HEAD_BYTE_COUNT,
    };
  } finally {
    closeSync(fileDescriptor);
  }
};

/*
 * Collects the string literals opening the module, stopping at the first token
 * that is neither a comment nor one of them. "complete" tells whether that
 * token was reached: when it was not, the source given was cut short and the
 * caller must read further before trusting the result.
 */
const scanDirectivePrologue = (source) => {
  const directiveTextArray = [];
  const length = source.length;
  let index = 0;
  if (source.startsWith("#!")) {
    const lineEndIndex = source.indexOf("\n");
    if (lineEndIndex === -1) {
      return { directiveTextArray, complete: false };
    }
    index = lineEndIndex + 1;
  }
  while (index < length) {
    const char = source[index];
    if (
      char === " " ||
      char === "\t" ||
      char === "\n" ||
      char === "\r" ||
      char === ";"
    ) {
      index++;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      const lineEndIndex = source.indexOf("\n", index);
      if (lineEndIndex === -1) {
        return { directiveTextArray, complete: false };
      }
      index = lineEndIndex + 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const commentEndIndex = source.indexOf("*/", index + 2);
      if (commentEndIndex === -1) {
        return { directiveTextArray, complete: false };
      }
      index = commentEndIndex + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let stringIndex = index + 1;
      let text = "";
      while (stringIndex < length) {
        const stringChar = source[stringIndex];
        if (stringChar === "\\") {
          text += source[stringIndex + 1];
          stringIndex += 2;
          continue;
        }
        if (stringChar === quote) {
          break;
        }
        if (stringChar === "\n") {
          // an unterminated string is not a directive, and not our problem
          return { directiveTextArray, complete: true };
        }
        text += stringChar;
        stringIndex++;
      }
      if (stringIndex >= length) {
        return { directiveTextArray, complete: false };
      }
      directiveTextArray.push(text);
      index = stringIndex + 1;
      continue;
    }
    return { directiveTextArray, complete: true };
  }
  return { directiveTextArray, complete: false };
};
