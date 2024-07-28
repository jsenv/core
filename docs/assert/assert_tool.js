import { assert } from "https://unpkg.com/@jsenv/assert@latest/dist/jsenv_assert_browser.js";
import { renderTerminalSvg } from "https://unpkg.com/@jsenv/terminal-recorder@latest";

const inputNode = document.querySelector("form");
const diffActualNode = document.querySelector("#diffActual");
const diffExpectNode = document.querySelector("#diffExpect");

inputNode.addEventListener("submit", onSubmit);

function getActualExpectFromUi() {
  let actual;
  let expect;
  try {
    actual = JSON.parse(inputNode.elements.actual.value);
    expect = JSON.parse(inputNode.elements.expect.value);
  } catch (error) {
    actual = inputNode.elements.actual.value;
    expect = inputNode.elements.expect.value;
  }
  return { actual, expect };
}

function outputDiff(diffActual, diffExpect) {
  const termOptions = {
    width: diffActualNode.offsetWidth,
  };
  diffActualNode.innerHTML = removeSvgWhitespaces(
    renderTerminalSvg(diffActual, { ...termOptions, title: "Diff on actual" }),
  );
  diffExpectNode.innerHTML = removeSvgWhitespaces(
    renderTerminalSvg(diffExpect, {
      ...termOptions,
      title: "Diff on expected",
    }),
  );
}

function removeSvgWhitespaces(svg) {
  const replaced = svg.replace(/\s*(<text.*<\/text>)\s*/gm, "$1");
  return replaced;
}

function onSubmit(evt) {
  evt.preventDefault();
  const { actual, expect } = getActualExpectFromUi();

  try {
    assert({
      actual,
      expect,
      MAX_COLUMNS: Math.floor(diffActualNode.offsetWidth / 8.4) - 1,
      MAX_DIFF_INSIDE_VALUE: Infinity,
      MAX_CONTEXT_BEFORE_DIFF: { prop: 6, line: 6 },
      MAX_CONTEXT_AFTER_DIFF: { prop: 6, line: 6 },
    });
    outputDiff("Actual is the same", "Expected is the same");
  } catch (error) {
    outputDiff(error.actualDiff, error.expectDiff);
  }
}
