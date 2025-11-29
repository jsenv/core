import { useLayoutEffect } from "preact/hooks";

export const useInitialTextSelection = (ref, textSelection) => {
  const deps = [];
  if (Array.isArray(textSelection)) {
    deps.push(...textSelection);
  } else {
    deps.push(textSelection);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !textSelection) {
      return;
    }

    const range = document.createRange();
    const selection = window.getSelection();
    if (Array.isArray(textSelection)) {
      if (textSelection.length === 2) {
        const [start, end] = textSelection;

        if (typeof start === "number" && typeof end === "number") {
          // Format: [0, 10] - character indices
          selectByCharacterIndices(el, range, start, end);
        } else if (typeof start === "string" && typeof end === "string") {
          // Format: ["Click on the", "button to return"] - text strings
          selectByTextStrings(el, range, start, end);
        }
      }
    } else if (typeof textSelection === "string") {
      // Format: "some text" - select the entire string occurrence
      selectSingleTextString(el, range, textSelection);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }, deps);
};

const selectByCharacterIndices = (element, range, startIndex, endIndex) => {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  let currentIndex = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;
    const nodeLength = textContent.length;

    // Check if start position is in this text node
    if (!startNode && currentIndex + nodeLength > startIndex) {
      startNode = walker.currentNode;
      startOffset = startIndex - currentIndex;
    }

    // Check if end position is in this text node
    if (currentIndex + nodeLength >= endIndex) {
      endNode = walker.currentNode;
      endOffset = endIndex - currentIndex;
      break;
    }

    currentIndex += nodeLength;
  }

  if (startNode && endNode) {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  }
};

const selectSingleTextString = (element, range, text) => {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;
    const index = textContent.indexOf(text);

    if (index !== -1) {
      range.setStart(walker.currentNode, index);
      range.setEnd(walker.currentNode, index + text.length);
      return;
    }
  }
};

const selectByTextStrings = (element, range, startText, endText) => {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false,
  );

  let startNode = null;
  let endNode = null;
  let foundStart = false;

  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;

    if (!foundStart && textContent.includes(startText)) {
      startNode = walker.currentNode;
      foundStart = true;
    }

    if (foundStart && textContent.includes(endText)) {
      endNode = walker.currentNode;
      break;
    }
  }

  if (startNode && endNode) {
    const startOffset = startNode.textContent.indexOf(startText);
    const endOffset = endNode.textContent.indexOf(endText) + endText.length;

    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  }
};
