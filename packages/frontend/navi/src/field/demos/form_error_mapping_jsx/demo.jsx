import { Button, Form, Input, Label, useCalloutClose } from "@jsenv/navi";
import { render } from "preact";
import { useRef, useState } from "preact/hooks";

const Demo = () => {
  const nameInputRef = useRef(null);
  const termsCheckboxRef = useRef(null);

  return (
    <div style={{ maxWidth: "400px", margin: "20px auto", padding: "20px" }}>
      <h1>Form Error Mapping JSX Demo</h1>
      <p>
        This form will always fail with different types of errors to test error
        mapping:
      </p>
      <ul>
        <li>Leave name empty → Validation Error</li>
        <li>Leave checkbox unchecked → Validation Error</li>
        <li>Valid inputs → Server Error</li>
      </ul>

      <Form
        row
        spacing="m"
        action={({ name, terms }) => {
          console.log("Submitting user:", { name, terms });

          // Simulate different types of validation errors
          if (!name || name.length < 1) {
            throw Object.assign(new Error("Name is required"), {
              field: "name",
              code: "VALIDATION_ERROR",
            });
          }

          if (!terms) {
            throw Object.assign(
              new Error("You must accept the terms and conditions"),
              {
                field: "terms",
                code: "VALIDATION_ERROR",
              },
            );
          }

          // Simulate a server error
          throw Object.assign(new Error("Server is temporarily unavailable"), {
            code: "SERVER_ERROR",
          });
        }}
        errorMapping={(error) => {
          if (error.code === "VALIDATION_ERROR") {
            return {
              target:
                error.field === "name"
                  ? nameInputRef.current
                  : error.field === "terms"
                    ? termsCheckboxRef.current
                    : null,
              message: <ValidationErrorMessage error={error} />,
            };
          }
          if (error.code === "SERVER_ERROR") {
            return <ServerErrorMessage error={error} />;
          }
          return <UnexpectedErrorMessage error={error} />;
        }}
        style={{
          border: "1px solid #ccc",
          padding: "20px",
          borderRadius: "8px",
          backgroundColor: "#f9f9f9",
        }}
      >
        <Label column spacing="s">
          Name
          <Input
            ref={nameInputRef}
            name="name"
            type="text"
            placeholder="Enter your name"
          />
        </Label>

        <Label column spacing="s">
          <Input ref={termsCheckboxRef} name="terms" type="checkbox" />I accept
          the terms and conditions
        </Label>

        <Button marginTop="m" type="submit">
          Submit Form
        </Button>
      </Form>
    </div>
  );
};

const ValidationErrorMessage = ({ error }) => {
  const closeCallout = useCalloutClose();
  const [dismissed, setDismissed] = useState(false);
  const [helpShown, setHelpShown] = useState(false);

  if (dismissed) {
    return (
      <div
        style={{
          color: "gray",
          padding: "5px",
          fontStyle: "italic",
        }}
      >
        Error dismissed
        <button
          style={{ marginLeft: "10px", fontSize: "12px" }}
          onClick={() => setDismissed(false)}
        >
          Show again
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        color: "red",
        padding: "10px",
        border: "1px solid red",
        borderRadius: "4px",
        backgroundColor: "#fee",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Validation Error:</strong>
        <button
          style={{
            background: "none",
            border: "none",
            color: "red",
            cursor: "pointer",
          }}
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
      </div>
      <p>{error.message}</p>
      {error.field && (
        <p>
          <em>Field: {error.field}</em>
        </p>
      )}
      <div style={{ marginTop: "10px" }}>
        <button
          style={{ fontSize: "12px", padding: "4px 8px", marginRight: "8px" }}
          onClick={() => setHelpShown(!helpShown)}
        >
          {helpShown ? "Hide Help" : "Show Help"}
        </button>
        <button
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "2px",
          }}
          onClick={closeCallout}
        >
          Close Callout
        </button>
        {helpShown && (
          <div
            style={{
              marginTop: "5px",
              fontSize: "12px",
              backgroundColor: "#fff",
              padding: "5px",
              borderRadius: "2px",
            }}
          >
            {error.field === "name" &&
              "Please enter any character for your name."}
            {error.field === "terms" &&
              "You need to check the checkbox to accept the terms."}
          </div>
        )}
      </div>
    </div>
  );
};
const ServerErrorMessage = ({ error }) => {
  const closeCallout = useCalloutClose();
  const [retryCount, setRetryCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      style={{
        color: "orange",
        padding: "10px",
        border: "1px solid orange",
        borderRadius: "4px",
        backgroundColor: "#ffd",
      }}
    >
      <strong>⚠️ Server Error</strong>
      <p>{error.message}</p>
      <p>
        <small>Please try again in a few moments.</small>
      </p>
      <div style={{ marginTop: "10px" }}>
        <button
          style={{ marginRight: "8px", fontSize: "12px", padding: "4px 8px" }}
          onClick={() => setRetryCount(retryCount + 1)}
        >
          Retry ({retryCount} attempts)
        </button>
        <button
          style={{ marginRight: "8px", fontSize: "12px", padding: "4px 8px" }}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide Details" : "Show Details"}
        </button>
        <button
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "2px",
          }}
          onClick={closeCallout}
        >
          Close Callout
        </button>
      </div>
      {showDetails && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            backgroundColor: "#fff",
            padding: "5px",
            borderRadius: "2px",
          }}
        >
          Error Code: {error.code}
          <br />
          Timestamp: {new Date().toLocaleTimeString()}
          <br />
          This is a simulated server error for demo purposes.
        </div>
      )}
    </div>
  );
};
const UnexpectedErrorMessage = ({ error }) => {
  const closeCallout = useCalloutClose();
  const [reportSent, setReportSent] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        color: "darkred",
        padding: "10px",
        border: "1px solid darkred",
        borderRadius: "4px",
        backgroundColor: "#fdd",
      }}
    >
      <strong>❌ Unexpected Error</strong>
      <p>{error.message || "Something went wrong"}</p>
      <div style={{ marginTop: "10px" }}>
        <button
          style={{
            marginRight: "8px",
            fontSize: "12px",
            padding: "4px 8px",
            backgroundColor: reportSent ? "#28a745" : "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "2px",
          }}
          onClick={() => setReportSent(true)}
          disabled={reportSent}
        >
          {reportSent ? "✓ Report Sent" : "Send Report"}
        </button>
        <button
          style={{ marginRight: "8px", fontSize: "12px", padding: "4px 8px" }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Less Info" : "More Info"}
        </button>
        <button
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "2px",
          }}
          onClick={closeCallout}
        >
          Close Callout
        </button>
      </div>
      {expanded && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "11px",
            backgroundColor: "#fff",
            padding: "5px",
            borderRadius: "2px",
            fontFamily: "monospace",
          }}
        >
          <strong>Stack trace (simulated):</strong>
          <br />
          Error: {error.message}
          <br />
          &nbsp;&nbsp;at FormAction (/demo.jsx:25)
          <br />
          &nbsp;&nbsp;at executeAction (/use_execute_action.js:89)
          <br />
          &nbsp;&nbsp;at handleSubmit (/form.jsx:156)
          <br />
        </div>
      )}
    </div>
  );
};

render(<Demo />, document.getElementById("root"));
