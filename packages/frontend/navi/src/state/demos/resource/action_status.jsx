import { useActionStatus } from "@jsenv/navi";
import { stringifyForDisplay } from "../../../utils/stringify_for_display.js";

export const ActionStatus = ({ action, name = action.name }) => {
  const { idle, preloaded, pending, params, error, aborted, data } =
    useActionStatus(action);

  return (
    <fieldset>
      <legend>{name}</legend>

      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div>
          <span>
            <span>loading state:</span>{" "}
            <strong>
              {idle
                ? "idle"
                : aborted
                  ? "aborted"
                  : error
                    ? "error"
                    : pending
                      ? "pending"
                      : preloaded
                        ? "preloaded"
                        : "loaded"}
            </strong>
          </span>
        </div>
        <div style="display: flex; gap: 5px;">
          <span>params: </span>
          <pre style="margin: 0">{stringifyForDisplay(params)}</pre>
        </div>
        <div style="display: flex; gap: 5px;">
          <span>data: </span>
          <pre style="margin: 0">{stringifyForDisplay(data)}</pre>
        </div>
      </div>
    </fieldset>
  );
};
