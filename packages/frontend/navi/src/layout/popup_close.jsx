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
