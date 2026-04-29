import { COLORS, renderTable } from "@jsenv/terminal-table";
import { applySearch } from "../apply_search.js";

const BORDER = { color: COLORS.GREY };

// Returns a string with matched ranges wrapped in [...].
// Returns null when there is no match.
export const display = (searchText, value) => {
  const result = applySearch(searchText, value);
  const str = String(value);
  if (!result.match) {
    return null;
  }
  const ranges = [...result.matchRanges].sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += str.slice(cursor, start);
    out += `[${str.slice(start, end)}]`;
    cursor = end;
  }
  out += str.slice(cursor);
  return out;
};

// Renders a table of (query, string, result) rows using @jsenv/terminal-table.
// Rows are sorted by score descending when a single query is used.
export const displayTable = (rows) => {
  const cell = (value) => ({ value, border: BORDER });
  const grid = [[cell("Query"), cell("String"), cell("Result")]];
  for (const [searchText, value] of rows) {
    const result = display(searchText, value);
    grid.push([
      cell(`"${searchText}"`),
      cell(`"${value}"`),
      cell(result === null ? "null" : `"${result}"`),
    ]);
  }
  return renderTable(grid, { borderCollapse: true, cellMaxWidth: 80 });
};

// Sort values by score descending and return a displayTable.
export const rank = (searchText, values) => {
  const sorted = values
    .map((value) => {
      const result = applySearch(searchText, value);
      return { value, score: result.matchScore };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ value }) => [searchText, value]);
  return displayTable(sorted);
};
