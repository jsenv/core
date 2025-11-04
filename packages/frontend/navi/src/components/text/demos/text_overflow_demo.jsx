import { Count, FlexColumn, Spacing, Text } from "@jsenv/navi";
import { useState } from "preact/hooks";

export const App = () => {
  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <h1>TextOverflow Component Demo</h1>

      {/* Basic Usage */}
      <section>
        <h2>Basic Text Overflow</h2>
        <Spacing width="200" border="1px solid #ccc" padding="sm">
          <Text overflowEllipsis>
            This is a very long text that should be truncated with ellipsis when
            it overflows
          </Text>
        </Spacing>
      </section>

      {/* With After Content */}
      <section>
        <h2>With Pinned Content</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <Text overflowEllipsis>
              This text has additional content after it that stays visible
              <Text overflowPinned textColor="#666">
                (modified)
              </Text>
            </Text>
          </div>

          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <Text overflowEllipsis>
              Text with count that is too long to be displayed entirely
              <Text overflowPinned textColor="#4caf50">
                <Count>10</Count>
              </Text>
            </Text>
          </div>
        </div>
      </section>

      {/* Different Container Sizes */}
      <section>
        <h2>Different Container Widths</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[150, 200, 300, 400].map((width) => (
            <div
              key={width}
              style={{
                width: `${width}px`,
                border: "1px solid #ccc",
                padding: "8px",
              }}
            >
              <div
                style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
              >
                Width: {width}px
              </div>
              <Text overflowEllipsis>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor
              </Text>
            </div>
          ))}
        </div>
      </section>

      {/* Different HTML Tags */}
      <section>
        <h2>Different HTML Elements</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;div&quot; (default)
            </div>
            <Text overflowEllipsis>
              This is rendered as a div element with overflow handling
            </Text>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;p&quot;
            </div>
            <Text as="p" overflowEllipsis>
              This is rendered as a paragraph element with overflow
            </Text>
          </div>

          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              as=&quot;span&quot;
            </div>
            <Text as="span" overflowEllipsis>
              This is rendered as a span element with overflow
            </Text>
          </div>
        </div>
      </section>

      {/* With Layout Props */}
      <section>
        <h2>With Layout Props</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With padding and margin
            </div>
            <Text padding="sm" margin="xs" backgroundColor="#f0f0f0">
              Text with padding and margin that will overflow properly
            </Text>
          </div>

          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With border and background
            </div>
            <Text
              padding="sm"
              backgroundColor="#e3f2fd"
              border="1px solid #2196f3"
              borderRadius="4px"
            >
              Styled text container with overflow handling and visual styling
            </Text>
          </div>
        </div>
      </section>

      {/* Complex After Content */}
      <section>
        <h2>Complex Pinned Content</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{ width: "280px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With icon after
            </div>
            <Text overflowEllipsis>
              Important message that might be too long to display fully
              <Text overflowPinned textColor="#f44336" textSize="sm">
                ⚠️
              </Text>
            </Text>
          </div>

          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              With multiple elements after
            </div>
            <Text overflowEllipsis>
              Document title with attachment count and icon that demonstrates
              overflow
              <Text overflowPinned>
                <div
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                >
                  <span style={{ fontSize: "12px", color: "#666" }}>(3)</span>
                  <span style={{ fontSize: "14px" }}>📎</span>
                </div>
              </Text>
            </Text>
          </div>
        </div>
      </section>

      {/* Interactive Examples */}
      <section>
        <h2>Interactive Width Control</h2>
        <InteractiveWidthDemo />
      </section>

      {/* Multiline Text Overflow Testing */}
      <section>
        <h2>Multiline Text Overflow Behavior</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Test 1: Text with line breaks */}
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Text with line breaks (\\n not respected by default)
            </div>
            <Text overflowEllipsis>
              First line of text{"\n"}
              Second line of text{"\n"}
              Third line that should overflow
            </Text>
          </div>

          {/* Test 2: Vertical alignment test */}
          <div
            style={{ width: "300px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Vertical alignment comparison
            </div>
            <FlexColumn style={{ lineHeight: "100px" }}>
              <Text overflowEllipsis style={{ maxWidth: "200px" }}>
                Just a long line of text that would get overflowed.
              </Text>
              <Text
                overflowEllipsis
                style={{ maxWidth: "200px", verticalAlign: "top" }}
              >
                Just a long line of text that would get overflowed.
              </Text>
            </FlexColumn>
          </div>
        </div>
      </section>
    </div>
  );
};

const InteractiveWidthDemo = () => {
  const [width, setWidth] = useState(200);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label htmlFor="width-slider">Container Width: {width}px</label>
        <input
          id="width-slider"
          type="range"
          min="100"
          max="500"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>

      <div
        style={{
          width: `${width}px`,
          border: "2px solid #2196f3",
          padding: "12px",
        }}
      >
        <Text overflowEllipsis textBold>
          Resize me to see how the text overflow behavior adapts to different
          container widths
          <Text overflowPinned textColor="#666">
            ✓
          </Text>
        </Text>
      </div>
    </div>
  );
};
