import { Spacing, Text } from "@jsenv/navi";
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
              Text with line breaks
            </div>
            <Text overflowEllipsis>
              First line of text{"\n"}
              Second line of text{"\n"}
              Third line that should overflow
            </Text>
          </div>

          {/* Test 2: Text without white-space: nowrap */}
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Without nowrap constraint
            </div>
            <Text overflowEllipsis style={{ whiteSpace: "normal" }}>
              This is a very long text that should wrap to multiple lines
              instead of being truncated with ellipsis. Let&apos;s see how it
              behaves.
            </Text>
          </div>

          {/* Test 3: Multiple lines with height constraint */}
          <div
            style={{
              width: "200px",
              height: "60px",
              border: "1px solid #ccc",
              padding: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Height constrained container
            </div>
            <Text overflowEllipsis style={{ whiteSpace: "normal" }}>
              This text is in a height-constrained container. It should wrap to
              multiple lines but the container itself has overflow hidden to see
              how it interacts with the text overflow behavior.
            </Text>
          </div>

          {/* Test 4: Multiline with pinned content */}
          <div
            style={{ width: "250px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Multiline with pinned content
            </div>
            <Text overflowEllipsis style={{ whiteSpace: "normal" }}>
              This is a longer text that will wrap to multiple lines and we want
              to see how the pinned content behaves in this scenario.
              <Text overflowPinned textColor="red">
                [PINNED]
              </Text>
            </Text>
          </div>

          {/* Test 5: CSS line-clamp simulation */}
          <div
            style={{ width: "200px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Line-clamp style (experimental)
            </div>
            <Text
              overflowEllipsis
              style={{
                whiteSpace: "normal",
                display: "-webkit-box",
                WebkitLineClamp: "3",
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              This text should be clamped to exactly 3 lines with ellipsis at
              the end of the third line. Let&apos;s see if this CSS approach
              works with our text overflow component.
              <Text overflowPinned textColor="blue">
                [END]
              </Text>
            </Text>
          </div>

          {/* Test 6: Very long single word */}
          <div
            style={{ width: "150px", border: "1px solid #ccc", padding: "8px" }}
          >
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}
            >
              Single long word
            </div>
            <Text overflowEllipsis>
              Supercalifragilisticexpialidocious-word-that-cannot-be-broken
              <Text overflowPinned>!</Text>
            </Text>
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
        <Text afterContent={<span style={{ color: "#666" }}>✓</span>} textBold>
          Resize me to see how the text overflow behavior adapts to different
          container widths
        </Text>
      </div>
    </div>
  );
};
