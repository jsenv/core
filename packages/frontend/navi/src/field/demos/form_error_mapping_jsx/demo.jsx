import { Button, Form, Input, Label } from "@jsenv/navi";
import { render } from "preact";
import { useRef } from "preact/hooks";

const Demo = () => {
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);

  return (
    <div style={{ maxWidth: "400px", margin: "20px auto", padding: "20px" }}>
      <h1>Form Error Mapping JSX Demo</h1>
      <p>
        This form will always fail with different types of errors to test error
        mapping:
      </p>
      <ul>
        <li>Leave name empty or less than 2 chars → Validation Error</li>
        <li>Leave email empty or invalid → Validation Error</li>
        <li>Valid inputs → Server Error</li>
      </ul>

      <Form
        row
        spacing="m"
        action={({ name, email }) => {
          console.log("Submitting user:", { name, email });

          // Simulate different types of validation errors
          if (!name || name.length < 2) {
            throw Object.assign(
              new Error("Name is required and must be at least 2 characters"),
              {
                field: "name",
                code: "VALIDATION_ERROR",
              },
            );
          }

          if (!email || !email.includes("@")) {
            throw Object.assign(
              new Error("Please enter a valid email address"),
              {
                field: "email",
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
                  : error.field === "email"
                    ? emailInputRef.current
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
          Email
          <Input
            ref={emailInputRef}
            name="email"
            type="email"
            placeholder="Enter your email"
          />
        </Label>

        <Button marginTop="m" type="submit">
          Submit Form
        </Button>
      </Form>
    </div>
  );
};

const ValidationErrorMessage = ({ error }) => {
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
      <strong>Validation Error:</strong>
      <p>{error.message}</p>
      {error.field && (
        <p>
          <em>Field: {error.field}</em>
        </p>
      )}
    </div>
  );
};
const ServerErrorMessage = ({ error }) => {
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
    </div>
  );
};
const UnexpectedErrorMessage = ({ error }) => {
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
    </div>
  );
};

render(<Demo />, document.getElementById("root"));
