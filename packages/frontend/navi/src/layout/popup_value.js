import { createContext } from "preact";
import { useContext } from "preact/hooks";

// The open controller's popupValueSignal (see open_controller.js), handed to
// the content by whatever renders it: Dialog, Popover, a picker's callout.
export const PopupValueContext = createContext(null);

/**
 * What the popup this is rendered inside is open ON: the value its `signal`
 * held while it read open (the id a single sheet bound to `?open=<id>` shows),
 * else its `value`, else the value of whatever opened it
 * (`<Button value={id} command="--navi-open">`).
 *
 * Held from the opening to the end of the exit, whoever asks the close: the
 * signal and the address read closed as soon as the close starts, while an
 * animated exit — and a lift flying back to the card it came from — still
 * draws what the content renders. A refused close keeps it; a reopening on
 * another value switches it at the reopening.
 *
 * @returns {any} `undefined` outside a popup.
 */
export const usePopupValue = () => {
  const popupValueSignal = useContext(PopupValueContext);
  return popupValueSignal ? popupValueSignal.value : undefined;
};
