import {
  preNewLineAndIndentation,
  wrapNewLineAndIndentation,
} from "../utils/indentation.js";
import { inspectConstructor } from "./constructor.js";

export const inspectArray = (
  value,
  {
    seen = [],
    nestedHumanize,
    depth,
    indentUsingTab,
    indentSize,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) {
    return "Symbol.for('circular')";
  }
  seen.push(value);

  let valuesSource = "";
  let i = 0;
  const j = value.length;

  while (i < j) {
    const valueSource = value.hasOwnProperty(i)
      ? nestedHumanize(value[i], { seen })
      : "";
    if (i === 0) {
      valuesSource += valueSource;
    } else {
      valuesSource += `,${preNewLineAndIndentation(valueSource, {
        depth,
        indentUsingTab,
        indentSize,
      })}`;
    }
    i++;
  }

  let arraySource;
  if (valuesSource.length) {
    arraySource = wrapNewLineAndIndentation(valuesSource, {
      depth,
      indentUsingTab,
      indentSize,
    });
  } else {
    arraySource = "";
  }

  arraySource = `[${arraySource}]`;

  return inspectConstructor(arraySource, { parenthesis, useNew });
};
