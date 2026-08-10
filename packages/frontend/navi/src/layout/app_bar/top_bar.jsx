/**
 * The bar at the top of a page: its title, and whatever that page needs beside
 * it.
 *
 * Served through a slot because not every page has one. `TopBarSlot` is
 * mounted once in the app layout; a page fills it by rendering `TopBar`, and
 * unmounting the page empties it again. That is also what makes the reserve
 * conditional: the space is published while the slot is filled and dropped
 * when it is not, so a page without a top bar starts at the top of the screen.
 *
 * The rest is what the bottom bar does — fixed rather than sticky, a reserve
 * derived from the same height variable, the safe-area inset added outside a
 * content-box height, a hairline drawn with a box-shadow. See
 * bottom_nav_bar.jsx and app_bar_space.js for why, including the
 * `viewport-fit=cover` an `env()` needs to be anything but 0.
 */

import { useLayoutEffect } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Title } from "../../text/title.jsx";
import { createSlot } from "../slot.jsx";
import { APP_BAR_SPACE_CSS, setAppBarSpace } from "./app_bar_space.js";

const css = /* css */ `
  @layer navi {
    :root {
      --navi-top-bar-height: 56px;
    }
  }

  ${APP_BAR_SPACE_CSS}

  .navi_top_bar {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 1;
    display: flex;
    box-sizing: content-box;
    width: 100%;
    max-width: var(--navi-app-max-width);
    height: var(--navi-top-bar-height);
    margin: 0 auto;
    padding-top: env(safe-area-inset-top);
    align-items: center;
    justify-content: center;
    background: var(--navi-app-bar-background);
    box-shadow: 0 1px 0 var(--navi-app-bar-border-color);
  }
`;

/**
 * @param {boolean} props.isFilled - Set by the slot; the bar renders nothing
 *   and reserves nothing until a page fills it.
 * @param {import("preact").ComponentChildren} [props.title] - Centered, as an
 *   `h1`. Give `children` instead (or as well) for anything else.
 */
const TopBarUI = ({ isFilled, title, children, ...props }) => {
  import.meta.css = css;

  useLayoutEffect(() => {
    if (!isFilled) {
      return undefined;
    }
    return setAppBarSpace(
      "top-bar",
      "calc(var(--navi-top-bar-height) + env(safe-area-inset-top))",
    );
  }, [isFilled]);

  if (!isFilled) {
    return null;
  }
  return (
    <Box as="header" baseClassName="navi_top_bar" {...props}>
      {title && (
        <Title as="h1" margin="0" size="24">
          {title}
        </Title>
      )}
      {children}
    </Box>
  );
};

const [Slot, Fill] = createSlot(TopBarUI);
/** Mount once, in the app layout, where the top bar belongs. */
export const TopBarSlot = Slot;
/** Render in a page to give that page a top bar. */
export const TopBar = Fill;
