/*
 * A button that does something and then closes the popup it is in:
 * <Button command="--navi-close" action={send}>. The command waits for the
 * action, and the two cases below differ only in whether the action's own
 * re-render takes that button away before it succeeds — which is what the
 * command's target used to be resolved against.
 */

import { Button, Popover, Text } from "@jsenv/navi";
import { render } from "preact";
import { useState } from "preact/hooks";

const Case = ({ id, replaceButton }) => {
  const [sent, setSent] = useState(false);

  return (
    <div>
      <Button id={`open_${id}`} command="--navi-open" commandfor={id}>
        {`open ${id}`}
      </Button>
      <Popover id={id} mount="while-opened" padding="m">
        {sent && replaceButton ? (
          <Text>sent</Text>
        ) : (
          <Button
            id={`confirm_${id}`}
            command="--navi-close"
            action={async () => {
              // What a request does before it resolves: the state is written
              // (a store upsert), so the re-render is queued while the action
              // is still running.
              setSent(true);
              await new Promise((resolve) => setTimeout(resolve, 200));
            }}
          >
            confirm
          </Button>
        )}
      </Popover>
    </div>
  );
};

render(
  <div>
    {/* the action replaces the button that asked to close */}
    <Case id="replaced" replaceButton />
    {/* the action leaves it in place */}
    <Case id="kept" replaceButton={false} />
  </div>,
  document.querySelector("#app"),
);
