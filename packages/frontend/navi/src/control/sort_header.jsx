import { Box } from "../box/box.jsx";
import {
  ChevronDownSvg,
  ChevronUpSvg,
} from "../graphic/icons/chevron_updown_svg.jsx";
import { Icon } from "../text/text.jsx";
import { sortI18n } from "../text/navi_i18n.js";
import { Button } from "./input/button.jsx";

const css = /* css */ `
  .navi_sort_header {
    > .navi_button {
      width: 100%;
    }

    /* Drawn on every header, shown on the sorting one: the label does not move
       when the order goes to another column. */
    .navi_sort_header_arrow {
      visibility: hidden;
    }
    &[data-sort] .navi_sort_header_arrow {
      visibility: visible;
    }

    .navi_sort_header_state {
      position: absolute;
      width: 1px;
      height: 1px;
      white-space: nowrap;
      clip-path: inset(50%);
      overflow: hidden;
    }
  }
`;

/**
 * The header of a column a list or a table can be ordered by: a press orders
 * by this column, a second one reverses it, and the header draws which way.
 *
 * The order lives in one signal, `{ column, direction }`, shared by every
 * header of the list — the one bound to the list's read, so a press asks for
 * the rows in that order. Any header renders where the caller puts it (a row of
 * Boxes above a `<List>`, a table's `<th>`): it is a Button with the label and
 * an arrow, laid out by the caller's own props.
 *
 * A screen reader hears the order as a header cell says it, `aria-sort`, when
 * the header is one (`as="th"`, or `role="columnheader"`/`"rowheader"`): only
 * that role carries it. Elsewhere the button's name says it ("Date, tri
 * décroissant").
 *
 * @type {import("preact").FunctionComponent<{
 *   column: string,
 *   signal: import("@preact/signals").Signal<{ column: string, direction: "asc" | "desc" } | undefined>,
 *   natural?: "asc" | "desc",
 *   as?: string,
 *   role?: string,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {string} column - What this header orders by, written into the
 *   signal's `column`.
 * @param signal - The order: `{ column, direction }`. `undefined` (or another
 *   column) leaves this header unsorted.
 * @param {"asc"|"desc"} [natural="asc"] - The direction of a first press: the
 *   way this column is read first — the newest dates first, `"desc"`.
 * @param {string} [as="div"] - The header's own element; `"th"` makes it the
 *   table's header cell, which wears `aria-sort`.
 */
export const SortHeader = ({
  column,
  signal,
  natural = "asc",
  as = "div",
  role,
  children,
  ...props
}) => {
  import.meta.css = css;
  const sort = signal.value;
  const direction = sort && sort.column === column ? sort.direction : undefined;
  const isHeaderCell =
    as === "th" || role === "columnheader" || role === "rowheader";

  return (
    <Box
      as={as}
      role={role}
      {...props}
      baseClassName="navi_sort_header"
      data-sort={direction}
      // One header at a time: the others have no order to say.
      aria-sort={
        isHeaderCell && direction
          ? direction === "desc"
            ? "descending"
            : "ascending"
          : undefined
      }
    >
      <Button
        variant="bare"
        uiAction={() => {
          const current = signal.peek();
          const next =
            current && current.column === column
              ? current.direction === "desc"
                ? "asc"
                : "desc"
              : natural;
          signal.value = { column, direction: next };
        }}
      >
        {children}
        <Icon className="navi_sort_header_arrow">
          {direction === "desc" ? <ChevronDownSvg /> : <ChevronUpSvg />}
        </Icon>
        {!isHeaderCell && direction ? (
          <span className="navi_sort_header_state">
            {", "}
            {sortI18n(
              direction === "desc" ? "sort.descending" : "sort.ascending",
            )}
          </span>
        ) : null}
      </Button>
    </Box>
  );
};
