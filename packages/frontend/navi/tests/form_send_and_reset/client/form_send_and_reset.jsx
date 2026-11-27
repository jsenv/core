/*
 * One form per question the suite asks about a form: what it sends, when it
 * sends nothing, what follows a send, what it goes back to. Every action
 * records what it receives in `window.formCalls[caseId]`, so a test reads the
 * sends as values rather than guessing them from the screen.
 */

import {
  Button,
  CheckboxGroup,
  ControlGroup,
  Field,
  Form,
  Input,
  Label,
  stateSignal,
} from "@jsenv/navi";
import { signal } from "@preact/signals";
import { render } from "preact";

window.formCalls = {};
const recordCall = (caseId, value) => {
  const calls = window.formCalls[caseId] || (window.formCalls[caseId] = []);
  calls.push(value);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const recordingAction = (caseId, { delay = 0 } = {}) => {
  return async (value) => {
    recordCall(caseId, value);
    if (delay) {
      await wait(delay);
    }
  };
};

const Case = ({ id, children }) => (
  <section id={id} style={{ border: "1px solid grey", margin: 8, padding: 8 }}>
    <h2 style={{ fontSize: 14, margin: 0 }}>{id}</h2>
    {children}
  </section>
);

const App = () => (
  <div>
    {/* An untouched form holding a yes/no: nothing to send. */}
    <Case id="untouched_boolean">
      <Form action={recordingAction("untouched_boolean")}>
        <Input
          id="untouched_boolean_agree"
          type="checkbox"
          boolean
          name="agree"
        />
        <Button
          id="untouched_boolean_save"
          type="submit"
          readOnlyWhileFormUnchanged
        >
          Save
        </Button>
      </Form>
    </Case>

    {/* An untouched form holding a checkbox group: nothing to send. */}
    <Case id="untouched_checkbox_group">
      <Form action={recordingAction("untouched_checkbox_group")}>
        <CheckboxGroup name="tags">
          <Input type="checkbox" value="a" />
          <Input type="checkbox" value="b" />
        </CheckboxGroup>
        <Button
          id="untouched_checkbox_group_save"
          type="submit"
          readOnlyWhileFormUnchanged
        >
          Save
        </Button>
      </Form>
    </Case>

    {/* An untouched form holding a named group of fields: nothing to send. */}
    <Case id="untouched_control_group">
      <Form action={recordingAction("untouched_control_group")}>
        <ControlGroup name="address">
          <Input name="street" />
        </ControlGroup>
        <Button
          id="untouched_control_group_save"
          type="submit"
          readOnlyWhileFormUnchanged
        >
          Save
        </Button>
      </Form>
    </Case>

    {/* A record nobody touched: the save waits for a change. */}
    <Case id="record_untouched">
      <Form
        record={{ name: "Ann" }}
        action={recordingAction("record_untouched")}
      >
        <Input name="name" />
        <Button
          id="record_untouched_save"
          type="submit"
          readOnlyWhileFormUnchanged
        >
          Save
        </Button>
      </Form>
    </Case>

    {/* Typed into while its optimistic send is out: the next send carries it. */}
    <Case id="optimistic_typing">
      <Form
        optimistic
        command="--navi-void"
        action={recordingAction("optimistic_typing", { delay: 300 })}
      >
        <Input id="optimistic_typing_title" name="title" />
      </Form>
    </Case>

    {/* Refused at once by a synchronous throw: what follows the send does not run. */}
    <Case id="sync_failure">
      <Form
        command="--navi-reset"
        action={(value) => {
          recordCall("sync_failure", value);
          throw new Error("refused");
        }}
      >
        <Input id="sync_failure_title" name="title" />
      </Form>
    </Case>

    {/* Enter in a field of a nested group: the form's own command follows. */}
    <Case id="nested_group_enter">
      <Form
        command="--navi-reset"
        action={recordingAction("nested_group_enter")}
      >
        <ControlGroup name="address">
          <Input id="nested_group_enter_street" name="street" />
        </ControlGroup>
      </Form>
    </Case>

    {/* requestSubmit(): the same send, the same command after it. */}
    <Case id="request_submit">
      <Form
        id="request_submit_form"
        command="--navi-reset"
        action={recordingAction("request_submit")}
      >
        <Input id="request_submit_title" name="title" />
      </Form>
    </Case>

    {/* A named submit says which button sent — that send only. */}
    <Case id="named_submit">
      <Form
        action={(value) => {
          recordCall("named_submit", value);
          if (value.intent === "publish") {
            throw new Error("cannot publish yet");
          }
        }}
      >
        <Input id="named_submit_title" name="title" />
        <Button
          id="named_submit_draft"
          type="submit"
          name="intent"
          value="draft"
        >
          Draft
        </Button>
        <Button
          id="named_submit_publish"
          type="submit"
          name="intent"
          value="publish"
        >
          Publish
        </Button>
      </Form>
    </Case>
  </div>
);

render(<App />, document.querySelector("#app"));

// Rendered apart: a constraint throwing while it renders takes this root down,
// not the cases above.
const ValidationCases = () => (
  <div>
    {/* A required checkbox alone — an "I accept" — has no group around it. */}
    <Case id="lone_required_checkbox">
      <Input id="lone_required_checkbox_input" type="checkbox" required />
    </Case>

    {/* `step` counted in each type's own unit, from `min`. */}
    <Case id="month_step">
      <Form action={recordingAction("month_step")}>
        <Input
          type="month"
          name="month"
          step="2"
          min="2026-01"
          defaultValue="2026-02"
        />
      </Form>
    </Case>
    <Case id="week_step">
      <Form action={recordingAction("week_step")}>
        <Input
          type="week"
          name="week"
          step="2"
          min="2026-W01"
          defaultValue="2026-W02"
        />
      </Form>
    </Case>
    <Case id="datetime_step">
      <Form action={recordingAction("datetime_step")}>
        <Input
          type="datetime-local"
          name="at"
          step="900"
          defaultValue="2026-11-27T10:05"
        />
      </Form>
    </Case>

    {/* The sentence written on the Field, for its control. */}
    <Case id="field_message">
      <Form action={recordingAction("field_message")}>
        <Field requiredMessage="Said by the field">
          <Label>Title</Label>
          <Input id="field_message_input" name="title" required />
        </Field>
      </Form>
    </Case>
  </div>
);
render(<ValidationCases />, document.querySelector("#app_validation"));

// What a control goes back to: a reset to where it starts, a rollback to what
// the outside last accepted.
const recordSignal = signal({ name: "Ann" });
const plainCheckedSignal = signal(false);
const stateCheckedSignal = stateSignal(false, {
  id: "form_send_and_reset_checked",
});
// Accepts the first save, refuses the next ones.
const acceptingOnce = (caseId) => {
  return async (value) => {
    recordCall(caseId, value);
    await wait(20);
    if (window.formCalls[caseId].length > 1) {
      throw new Error("refused");
    }
  };
};
const RollbackCases = () => (
  <div>
    {/* The server answers a save with the value normalized. */}
    <Case id="record_normalized">
      <Form
        record={recordSignal.value}
        action={async (value) => {
          recordCall("record_normalized", value);
          await wait(20);
          recordSignal.value = { name: value.name.trim() };
        }}
      >
        <Input id="record_normalized_name" name="name" />
        <Button
          id="record_normalized_save"
          type="submit"
          readOnlyWhileFormUnchanged
        >
          Save
        </Button>
      </Form>
    </Case>

    {/* A yes/no saved once, then refused: back to what was saved. */}
    <Case id="plain_signal_rollback">
      <Input
        id="plain_signal_rollback_box"
        type="checkbox"
        boolean
        signal={plainCheckedSignal}
        action={acceptingOnce("plain_signal_rollback")}
      />
    </Case>
    <Case id="state_signal_rollback">
      <Input
        id="state_signal_rollback_box"
        type="checkbox"
        boolean
        signal={stateCheckedSignal}
        action={acceptingOnce("state_signal_rollback")}
      />
    </Case>

    {/* Refused once: the same value asked again is a new request. */}
    <Case id="retry_refused">
      <Input
        id="retry_refused_input"
        actionEvent="change"
        resetOnError
        action={(value) => {
          recordCall("retry_refused", value);
          throw new Error("refused");
        }}
      />
    </Case>

    {/* Sent, then reset: back to its default, not to what was sent. */}
    <Case id="reset_to_default">
      <Form command="--navi-reset" action={recordingAction("reset_to_default")}>
        <Input id="reset_to_default_title" name="title" defaultValue="draft" />
      </Form>
    </Case>
  </div>
);
render(<RollbackCases />, document.querySelector("#app_rollback"));
