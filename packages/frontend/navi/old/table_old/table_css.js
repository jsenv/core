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

  .navi_table th,
  .navi_table td {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  /* Table borders using ::before pseudo-elements */
  /* Default: each cell draws all its own borders (no border-collapse) */
  .navi_table th,
  .navi_table td {
    /* Required for pseudo-element positioning */
    position: relative;
    border: none; /* Remove default borders - we'll use pseudo-elements */
  }

  .navi_table th::before,
  .navi_table td::before {
    position: absolute;
    inset: 0;
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
    pointer-events: none;
    content: "";
  }
  .navi_table th::after,
  .navi_table td::after {
    position: absolute;
    /* Default: include bottom and right borders (owned by this cell) */
    inset: 0;
    pointer-events: none;
    content: "";
  }

  .navi_table th,
  .navi_table td {
    text-align: left;
    background-color: var(--background-color, white);
  }

  .navi_table th {
    padding: 0;
    font-weight: normal;
    background-color: var(--background-color, #d3e7ff);
  }

  /* padding */
  .navi_table th,
  .navi_table td {
    padding-top: 8px;
    padding-right: 12px;
    padding-bottom: 8px;
    padding-left: 12px;
  }
  .navi_table [data-width-xxs] {
    padding-right: 0;
    padding-left: 0;
  }
  .navi_table [data-height-xxs] {
    padding-top: 0;
    padding-bottom: 0;
  }
  .navi_table td[data-editing] {
    padding: 0;
  }
  .navi_table td[data-editing] input {
    padding: 0;
    padding-left: 12px;
  }
  .navi_table [data-sticky-left-frontier] {
    /* padding-left: 12px; */
    /* 12 px + 5px of the sticky frontier */
    /* padding-right: 17px; */
  }

  .navi_table th,
  .navi_table td {
    user-select: none;
  }

  /* Number column specific styling */
  .navi_row_number_cell {
    color: #666;
    font-weight: 500;
    text-align: center;
    background: #fafafa;
    user-select: none;
  }

  .navi_table_cell_content_bold_clone {
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    font-weight: bold; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    pointer-events: none; /* inert */
    overflow: hidden; /* avoid any accidental height */
  }

  /* Border-collapse mode: each cell only owns specific borders to avoid doubling */

  /* Base rule: all cells get right and bottom borders */
  .navi_table[data-border-collapse] th::before,
  .navi_table[data-border-collapse] td::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells (all th) get top border in addition to right and bottom */
  .navi_table[data-border-collapse] th::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells get left border in addition to right and bottom */
  .navi_table[data-border-collapse] th:first-child::before,
  .navi_table[data-border-collapse] td:first-child::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column gets all four borders */
  .navi_table[data-border-collapse] th:first-child::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Focus styles */
  .navi_table td[data-focus],
  .navi_table th[data-focus] {
    outline: none; /* Remove default outline */
  }

  .navi_table th[data-focus]::after,
  .navi_table td[data-focus]::after {
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

  .navi_table td[data-editing] .navi_table_cell_content {
    outline: 2px solid #a8c7fa;
    outline-offset: 0px;
  }

  .navi_table td[data-editing] input {
    display: inline-flex;
    width: 100%;
    height: 100%;
    flex-grow: 1;
    font-size: 16px;
    border: none;
    border-radius: 0; /* match table cell border-radius */
  }

  .navi_table td[data-editing] input[type="number"]::-webkit-inner-spin-button {
    width: 14px;
    height: 30px;
  }

  .navi_table td[data-editing] {
    z-index: ${Z_INDEX_EDITING};
    outline: 2px solid var(--editing-border-color);
  }
`;
