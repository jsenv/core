/**
 * What a popup is called, decided by Dialog and Popover alike: the name the
 * caller writes on it (aria-label/aria-labelledby), else the title it holds
 * (`<Popup.Title>`), else the name of what opened it (`openerAriaLabelledBy` /
 * `openerAriaLabel`, which a Picker fills with its trigger's). A popup no one
 * names is announced as "dialog" and nothing else.
 *
 * The title tells the popup it exists rather than the popup looking for it:
 * the content is built after the popup and thrown away before it (see
 * popup_content_mount.js), and a title may sit anywhere in it — a header, a
 * step of a form — so only the title knows when it is there.
 */

import { createContext } from "preact";
import { useContext, useLayoutEffect, useMemo, useState } from "preact/hooks";

import { Title } from "../text/title.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { useGeneratedId } from "../utils/use_generated_id.js";

const css = /* css */ `
  @layer navi {
    /* Offered back: a popup's title is most often the text of its header row,
       beside the close cross, where a heading's own margins and size would
       make the row taller and its text bigger. The margin and size props, or
       a rule of the app's, take them back. */
    .navi_popup_title {
      margin-block: 0;
      font-size: inherit;
    }
  }
`;

// The popup a title names: the nearest one around it. A surface that is no
// popup of this kind but holds content of its own (a picker's callout) sets it
// back to null, so a title in there names nothing rather than the popup around.
export const PopupTitleContext = createContext(null);

/**
 * The title of the popup it sits in — reached as `<Popup.Title>`,
 * `<Dialog.Title>` or `<Popover.Title>`. A heading (`h2` unless `as` says
 * otherwise) that is also the popup's accessible name: a screen reader
 * announces the popup by it, and `getByRole("dialog", { name })` finds it.
 * An `aria-label`/`aria-labelledby` written on the popup itself wins over it.
 * It is written at the size of what holds it, bold, with no heading margins —
 * the text of a header row — unless `size` or `margin` say otherwise.
 *
 * @type {import("preact").FunctionComponent<{
 *   as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
 *   id?: string,
 *   children?: import("preact").ComponentChildren,
 * } & Record<string, any>>}
 */
export const PopupTitle = (props) => {
  import.meta.css = css;
  const registerTitle = useContext(PopupTitleContext);
  const idDefault = useGeneratedId();
  const id = props.id || `popup_title_${idDefault}`;
  useLayoutEffect(() => {
    if (!registerTitle) {
      return undefined;
    }
    return registerTitle(id);
  }, [registerTitle, id]);

  return (
    <Title
      as="h2"
      {...props}
      baseClassName={withPropsClassName(
        "navi_popup_title",
        props.baseClassName,
      )}
      id={id}
    />
  );
};

/**
 * The name props of a popup element, and what its titles register with —
 * handed to its children through PopupTitleContext.
 */
export const usePopupName = ({
  ariaLabel,
  ariaLabelledBy,
  openerAriaLabel,
  openerAriaLabelledBy,
}) => {
  // Several titles is a content of the caller's own making (two steps both
  // mounted): the first one registered names the popup.
  const [titleIds, setTitleIds] = useState(NO_TITLE);
  const registerTitle = useMemo(() => {
    return (id) => {
      setTitleIds((ids) => [...ids, id]);
      return () => {
        setTitleIds((ids) => ids.filter((each) => each !== id));
      };
    };
  }, []);

  let labelledBy;
  let label;
  if (ariaLabelledBy !== undefined || ariaLabel !== undefined) {
    labelledBy = ariaLabelledBy;
    label = ariaLabel;
  } else if (titleIds.length > 0) {
    labelledBy = titleIds[0];
  } else if (openerAriaLabelledBy !== undefined) {
    labelledBy = openerAriaLabelledBy;
  } else {
    label = openerAriaLabel;
  }
  return [
    {
      "aria-labelledby": labelledBy,
      "aria-label": label,
    },
    registerTitle,
  ];
};
const NO_TITLE = [];
