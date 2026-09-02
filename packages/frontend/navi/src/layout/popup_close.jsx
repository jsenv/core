import { Button } from "../control/input/button.jsx";
import { Icon } from "../text/text.jsx";
import { CloseSvg } from "../graphic/icons/close_svg.jsx";
import { naviI18n } from "../text/navi_i18n.js";

/**
 * The cross that closes the popup it sits in — reached as `<Popup.Close />`,
 * `<Dialog.Close />` or `<Popover.Close />`. A discrete icon button sending
 * `--navi-close`, which the nearest popup above it answers; the caller only
 * decides where it goes (the right end of a header, most of the time).
 *
 * It is the way out of a popup, so it is the one affordance in there that the
 * surrounding control's read-only and disabled do not reach: a read-only picker
 * still opens (reading changes nothing) and hands its popup that read-only, and
 * a cross wearing it would trap the user in a popup they were invited to read.
 * A close button written by hand inherits it and refuses the press — which is
 * the reason to use this one rather than a `<Button command="--navi-close" />`.
 *
 * Exempt from the state around it, never from the popup's own answer: the cross
 * ASKS, and the popup decides — a dialog holding a form mid-send keeps the
 * close, an `onRequestClose` calling `preventDefault()` keeps it too.
 *
 * @type {import("preact").FunctionComponent<{
 *   label?: string,
 * } & Record<string, any>>}
 * @param {string} [props.label] - What assistive tech reads for the cross
 *   (navi's own "Close" text by default, in the active language).
 */
export const PopupClose = ({ label, ...rest }) => {
  return (
    <Button
      command="--navi-close"
      icon
      variant="discrete"
      // Dismissing writes nothing to whatever control the popup belongs to, so
      // that control's read-only and disabled are not about this cross: a
      // read-only picker still opens to be read (see readonly_constraint.js),
      // and what is opened has to be closable. Whether closing is allowed at
      // this instant is the popup's own question, answered by the popup — a
      // dialog holds the close while an action inside it runs (see
      // findBusyElementInside in dialog.jsx).
      whenSelfInteractionsBlocked="ignore"
      // The cross is drawn at the control size, which is a few millimetres
      // wide; the padding is what makes it a target a thumb can hit.
      paddingX="s"
      paddingY="s"
      aria-label={label === undefined ? naviI18n("button.close") : label}
      {...rest}
    >
      <Icon>
        <CloseSvg />
      </Icon>
    </Button>
  );
};
