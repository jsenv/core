/*
 * Compose a sourcemap with a set of content edits WITHOUT generating a map
 * for the edited content: the edits are applied to the existing map as
 * position shifts. Composing map A with the generated map of the edits
 * walks every segment of a full-file map (boundary density) and traces
 * each one through A; shifting walks A's own segments once with pure
 * arithmetic, and the result keeps exactly A's density and information (a
 * generated edit map adds no knowledge about the unchanged content, it
 * only densifies around it).
 *
 * Edit offsets refer to the content BEFORE any edit (magic-string
 * semantics): every edit lives in that single coordinate space, and the
 * shifts accumulate while walking segments and edits together in document
 * order. Segments strictly inside a replaced span are dropped (that
 * position does not exist anymore — magic-string drops interior mappings
 * the same way).
 */

import { decode, encode } from "@jridgewell/sourcemap-codec";

export const applyContentEditsOnSourcemap = (sourcemap, { content, edits }) => {
  if (typeof sourcemap.mappings !== "string") {
    return null;
  }

  // Flatten the edit list into sorted, non-overlapping spans.
  // - append never moves anything before it: ignored
  // - prepend accumulates into a single insertion at (0, 0); successive
  //   magic-string prepends each land BEFORE the previous one
  const spans = [];
  let prependText = "";
  for (const edit of edits) {
    if (edit.type === "append") {
      continue;
    }
    if (edit.type === "prepend") {
      prependText = edit.text + prependText;
      continue;
    }
    spans.push({
      start: edit.start,
      end: edit.end,
      replacement: edit.type === "remove" ? "" : edit.replacement,
    });
  }
  if (prependText) {
    spans.push({ start: 0, end: 0, replacement: prependText });
  }
  if (spans.length === 0) {
    return sourcemap;
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  let spanIndex = 1;
  while (spanIndex < spans.length) {
    const previousSpan = spans[spanIndex - 1];
    const span = spans[spanIndex];
    if (
      span.start === previousSpan.start &&
      span.end === previousSpan.end &&
      span.replacement === previousSpan.replacement
    ) {
      // the same edit applied twice: magic-string re-overwrites the range
      // with the same content, one application yields the same result
      // (happens with import.meta.css template replacements)
      spans.splice(spanIndex, 1);
      continue;
    }
    if (span.start < previousSpan.end) {
      // genuinely overlapping distinct edits: their combined effect cannot
      // be expressed as independent shifts
      return null;
    }
    spanIndex++;
  }

  let lineStarts;
  const offsetToLineColumn = (offset) => {
    if (!lineStarts) {
      lineStarts = [0];
      let index = content.indexOf("\n");
      while (index !== -1) {
        lineStarts.push(index + 1);
        index = content.indexOf("\n", index + 1);
      }
    }
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return { line: low, column: offset - lineStarts[low] };
  };

  const records = spans.map(({ start, end, replacement }) => {
    const startLocation = offsetToLineColumn(start);
    const endLocation = offsetToLineColumn(end);
    let insertedLineCount = 0;
    let lastNewlineIndex = -1;
    let newlineIndex = replacement.indexOf("\n");
    while (newlineIndex !== -1) {
      insertedLineCount++;
      lastNewlineIndex = newlineIndex;
      newlineIndex = replacement.indexOf("\n", newlineIndex + 1);
    }
    return {
      startLine: startLocation.line,
      startColumn: startLocation.column,
      endLine: endLocation.line,
      endColumn: endLocation.column,
      insertedLineCount,
      insertedLastLineLength:
        insertedLineCount === 0
          ? replacement.length
          : replacement.length - lastNewlineIndex - 1,
    };
  });

  // Walk segments and edits together in document order. The transform state
  // says how a position at or after the last applied edit end moves:
  // - on the same old line as that end: rebased on the end's new position
  // - on a later line: shifted by the accumulated line delta
  let recordIndex = 0;
  let lineDelta = 0;
  let tailOldLine = -1;
  let tailOldColumn = 0;
  let tailNewLine = 0;
  let tailNewColumn = 0;
  const transformPosition = (line, column) => {
    if (line === tailOldLine && column >= tailOldColumn) {
      return [tailNewLine, tailNewColumn + (column - tailOldColumn)];
    }
    return [line + lineDelta, column];
  };
  const applyRecord = (record) => {
    const [newStartLine, newStartColumn] = transformPosition(
      record.startLine,
      record.startColumn,
    );
    let newEndLine;
    let newEndColumn;
    if (record.insertedLineCount === 0) {
      newEndLine = newStartLine;
      newEndColumn = newStartColumn + record.insertedLastLineLength;
    } else {
      newEndLine = newStartLine + record.insertedLineCount;
      newEndColumn = record.insertedLastLineLength;
    }
    tailOldLine = record.endLine;
    tailOldColumn = record.endColumn;
    tailNewLine = newEndLine;
    tailNewColumn = newEndColumn;
    lineDelta = newEndLine - record.endLine;
  };
  const isAtOrAfterEnd = (line, column, record) => {
    if (line > record.endLine) {
      return true;
    }
    return line === record.endLine && column >= record.endColumn;
  };
  const isStrictlyInside = (line, column, record) => {
    const afterStart =
      line > record.startLine ||
      (line === record.startLine && column > record.startColumn);
    if (!afterStart) {
      return false;
    }
    return (
      line < record.endLine ||
      (line === record.endLine && column < record.endColumn)
    );
  };

  const decoded = decode(sourcemap.mappings);
  const decodedShifted = [];
  const pushSegment = (newLine, segment) => {
    while (decodedShifted.length <= newLine) {
      decodedShifted.push([]);
    }
    decodedShifted[newLine].push(segment);
  };
  for (let lineIndex = 0; lineIndex < decoded.length; lineIndex++) {
    for (const segment of decoded[lineIndex]) {
      const column = segment[0];
      while (
        recordIndex < records.length &&
        isAtOrAfterEnd(lineIndex, column, records[recordIndex])
      ) {
        applyRecord(records[recordIndex]);
        recordIndex++;
      }
      if (
        recordIndex < records.length &&
        isStrictlyInside(lineIndex, column, records[recordIndex])
      ) {
        continue;
      }
      const [newLine, newColumn] = transformPosition(lineIndex, column);
      if (newColumn === column && newLine === lineIndex) {
        pushSegment(newLine, segment);
        continue;
      }
      const segmentShifted = segment.slice();
      segmentShifted[0] = newColumn;
      pushSegment(newLine, segmentShifted);
    }
  }

  return {
    ...sourcemap,
    mappings: encode(decodedShifted),
  };
};
