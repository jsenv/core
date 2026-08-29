import { createMagicSource } from "@jsenv/sourcemap";

// Comments are taken out in place, leaving every line where it is: the line
// numbers a stack trace shows stay those of the source. A comment sharing its
// line with code is replaced by spaces, so the code keeps its columns too.
// A license notice stays (@license, @preserve): the code it covers is
// shipped, the notice must be too.
export const stripJsComments = (urlInfo) => {
  const { content } = urlInfo;
  const allComments = urlInfo.contentAst.comments || [];
  const comments = allComments.filter((comment) => !mustKeepComment(comment));
  const magicSource = createMagicSource(content);
  // Whatever trails the last code (comments, blank lines) goes: the file
  // ends right after its last token, the way a generated file does.
  let tailStart = content.length;
  const allCommentsFromEnd = allComments.slice().sort((a, b) => b.end - a.end);
  let tailCommentIndex = 0;
  while (true) {
    while (tailStart > 0 && /\s/.test(content[tailStart - 1])) {
      tailStart--;
    }
    const comment = allCommentsFromEnd[tailCommentIndex];
    if (comment && comment.end === tailStart && !mustKeepComment(comment)) {
      tailStart = comment.start;
      tailCommentIndex++;
      continue;
    }
    break;
  }
  if (tailStart === content.length && comments.length === 0) {
    return null;
  }
  if (tailStart < content.length) {
    magicSource.remove({ start: tailStart, end: content.length });
  }
  for (const comment of comments) {
    const { start, end } = comment;
    if (start >= tailStart) {
      continue;
    }
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = content.indexOf("\n", end);
    if (lineEnd === -1) {
      lineEnd = content.length;
    }
    const before = content.slice(lineStart, start);
    const after = content.slice(end, lineEnd);
    const commentText = content.slice(start, end);
    const lineBreaks = "\n".repeat(commentText.split("\n").length - 1);
    if (before.trim() === "" && after.trim() === "") {
      // alone on its line(s): they become empty lines
      magicSource.replace({
        start: lineStart,
        end: lineEnd,
        replacement: lineBreaks,
      });
      continue;
    }
    if (after.trim() === "") {
      // ends the line: goes away with the spaces separating it from the code
      const spacesBefore = before.length - before.trimEnd().length;
      magicSource.replace({
        start: start - spacesBefore,
        end: lineEnd,
        replacement: lineBreaks,
      });
      continue;
    }
    // code follows on the same line
    magicSource.replace({
      start,
      end,
      replacement: commentText.replace(/[^\n]/g, " "),
    });
  }
  return magicSource.toContentAndSourcemap();
};

const mustKeepComment = ({ text }) => {
  return text.includes("@license") || text.includes("@preserve");
};
