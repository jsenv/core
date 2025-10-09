import { Z_INDEX_EDITING } from "./z_indexes.js";

/*
 * Box-shadow border mapping template:
 *
 * box-shadow:
 *   inset 0 1px 0 0 color,    // Top border
 *   inset 1px 0 0 0 color,    // Left border
 *   inset -1px 0 0 0 color,   // Right border
 *   inset 0 -1px 0 0 color;   // Bottom border
 */

import.meta.css = /* css */ `
  .navi_table_root {
    position: relative;
    max-width: var(--table-max-width, none);
    max-height: var(--table-max-height, none);
  }

  .navi_table_container {
    --border-color: #e1e1e1;
    --focus-border-color: #0078d4;

    position: relative;
  }

  .navi_table {
    border-radius: 2px;
    border-spacing: 0; /* Required for manual border collapse */
  }

  .navi_colgroup {
    display: none;
  }
  .navi_tr {
    display: block;
  }
  .navi_table_cell {
    display: inline-flex;
  }

  .navi_table_cell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Table borders using ::before pseudo-elements */
  /* Default: each cell draws all its own borders (no border-collapse) */
  .navi_table_cell {
    border: none; /* Remove default borders - we'll use pseudo-elements */
    /* Required for pseudo-element positioning */
    position: relative;
  }

  .navi_table_cell::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }
  .navi_table_cell::after {
    content: "";
    position: absolute;
    /* Default: include bottom and right borders (owned by this cell) */
    inset: 0;
    pointer-events: none;
  }

  /* padding */
  .navi_table_cell {
    padding-left: 12px;
    padding-right: 12px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .navi_table_cell[data-width-xxs] {
    padding-left: 0;
    padding-right: 0;
  }
  .navi_table_cell[data-height-xxs] {
    padding-top: 0;
    padding-bottom: 0;
  }
  .navi_table_cell[data-editing] {
    padding: 0;
  }
  .navi_table_cell[data-editing] input {
    padding: 0;
    padding-left: 12px;
  }
  .navi_table [data-sticky-left-frontier] {
    /* padding-left: 12px; */
    /* 12 px + 5px of the sticky frontier */
    /* padding-right: 17px; */
  }

  .navi_table_cell {
    user-select: none;
  }

  /* Number column specific styling */
  .navi_row_number_cell {
    text-align: center;
    background: #fafafa;
    font-weight: 500;
    color: #666;
    user-select: none;
  }

  .navi_table_cell_content_bold_clone {
    font-weight: bold; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  /* Border-collapse mode: each cell only owns specific borders to avoid doubling */

  /* Base rule: all cells get right and bottom borders */
  .navi_table[data-border-collapse] .navi_table_cell::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells (all th) get top border in addition to right and bottom */
  .navi_table[data-border-collapse] .navi_table_cell[data-first-row]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells get left border in addition to right and bottom */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column gets all four borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Focus styles */
  .navi_table_cell[data-focus] {
    outline: none; /* Remove default outline */
  }

  .navi_table_cell[data-focus]::after {
    box-shadow:
      inset 0 2px 0 0 var(--focus-border-color),
      inset -2px 0 0 0 var(--focus-border-color),
      inset 0 -2px 0 0 var(--focus-border-color),
      inset 2px 0 0 0 var(--focus-border-color) !important;
  }

  .navi_table {
    font-size: 16px;
    font-family: Arial;

    --editing-border-color: #a8c7fa;
  }

  .navi_table_cell[data-editing] .navi_table_cell_content {
    outline: 2px solid #a8c7fa;
    outline-offset: 0px;
  }

  .navi_table_cell[data-editing] input {
    width: 100%;
    height: 100%;
    display: inline-flex;
    flex-grow: 1;
    border-radius: 0; /* match table cell border-radius */
    border: none;
    font-size: 16px;
  }

  .navi_table_cell[data-editing]
    input[type="number"]::-webkit-inner-spin-button {
    width: 14px;
    height: 30px;
  }

  .navi_table_cell[data-editing] {
    outline: 2px solid var(--editing-border-color);
    z-index: ${Z_INDEX_EDITING};
  }
`;
