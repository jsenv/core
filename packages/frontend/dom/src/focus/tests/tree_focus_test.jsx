import { Details } from "@jsenv/navi";
import { render } from "preact";

// Add CSS styles
import.meta.css = /* css */ `
  body {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 20px auto;
    padding: 20px;
    line-height: 1.6;
  }

  .tree-container {
    border: 2px solid #333;
    padding: 20px;
    margin: 20px 0;
    background: #f9f9f9;
  }

  details {
    margin: 8px 0;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
  }

  summary {
    padding: 12px;
    background: #e8e8e8;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    font-weight: bold;
  }

  summary:hover {
    background: #d8d8d8;
  }

  .content {
    padding-left: 16px;
  }

  .focusable-item {
    display: block;
    padding: 8px 12px;
    margin: 4px 0;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    text-decoration: none;
    color: #333;
    cursor: pointer;
  }

  .focusable-item:hover {
    background: #f0f8ff;
    border-color: #0066cc;
  }

  .focusable-item:focus {
    outline: 2px solid #0066cc;
    outline-offset: 1px;
    background: #e6f3ff;
  }

  .debug {
    position: fixed;
    top: 10px;
    right: 10px;
    width: 300px;
    background: #222;
    color: #fff;
    padding: 10px;
    border-radius: 4px;
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  .debug h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
  }

  .status-line {
    margin: 2px 0;
    padding: 2px 4px;
    background: #333;
    border-radius: 2px;
  }

  .test-input-container {
    margin: 20px 0;
    padding: 10px;
    border-radius: 4px;
  }

  .before-tree {
    border: 2px solid #0066cc;
    background: #f0f8ff;
  }

  .after-tree {
    border: 2px solid #cc6600;
    background: #fff8f0;
  }

  input,
  button {
    margin-left: 10px;
    padding: 5px;
  }

  button {
    padding: 5px 10px;
  }
`;

const TreeFocusTest = () => {
  return (
    <div>
      <h1>Tree Focus Group Test - Preact</h1>

      <p>
        This demonstrates a tree-like structure using @jsenv/navi&apos;s{" "}
        <code>&lt;Details&gt;</code> component with focus groups.
      </p>

      {/* Test element before the tree */}
      <div className="test-input-container before-tree">
        <label htmlFor="before-input">Input before tree (Tab test):</label>
        <input
          id="before-input"
          type="text"
          placeholder="Focus me, then press Tab"
        />
      </div>

      <div className="tree-container">
        <h2>File System Tree</h2>

        {/* Root level details */}
        <Details
          focusGroup
          focusGroupDirection="vertical"
          open
          label={"📁 Projects"}
        >
          <div className="content">
            {/* Nested details level 1 */}
            <Details focusGroup focusGroupDirection="vertical" label="📁 src">
              <div className="content">
                {/* Nested details level 2 */}
                <Details
                  focusGroup
                  focusGroupDirection="vertical"
                  label="📁 components"
                >
                  <div className="content">
                    <div tabIndex="-1" className="focusable-item">
                      📄 Button.jsx
                    </div>
                    <div tabIndex="-1" className="focusable-item">
                      📄 Modal.jsx
                    </div>
                  </div>
                </Details>
              </div>
            </Details>

            <Details focusGroup focusGroupDirection="vertical" label="📁 utils">
              <div className="content">
                <div tabIndex="-1" className="focusable-item">
                  📄 helpers.js
                </div>
                <div tabIndex="-1" className="focusable-item">
                  📄 config.js
                </div>
              </div>
            </Details>

            <div tabIndex="0" className="focusable-item">
              📄 README.md
            </div>
            <div tabIndex="0" className="focusable-item">
              📄 package.json
            </div>
            <div tabIndex="0" className="focusable-item">
              📄 .gitignore
            </div>
          </div>
        </Details>
      </div>

      {/* Test element after the tree */}
      <div className="test-input-container after-tree">
        <label htmlFor="after-input">Input after tree (Tab test):</label>
        <input
          id="after-input"
          type="text"
          placeholder="Should receive focus after tree"
        />
        <button>Button after tree</button>
      </div>

      <div className="tree-container">
        <h2>Expected Focus Group Behavior</h2>
        <ul>
          <li>
            <strong>Tab Navigation:</strong> Should skip over focus groups
            entirely - from &quot;Input before tree&quot; directly to
            &quot;Input after tree&quot;
          </li>
          <li>
            <strong>Arrow Up/Down:</strong> Navigates within the current focus
            group (vertical)
          </li>
          <li>
            <strong>Future Implementation:</strong> Arrow Left/Right to
            collapse/expand or move between sibling groups
          </li>
        </ul>

        <h3>Tab Navigation Test</h3>
        <ol>
          <li>Click on &quot;Input before tree&quot; field above</li>
          <li>
            Press Tab - should jump directly to &quot;Input after tree&quot;
            (skipping all focus groups)
          </li>
          <li>
            Press Shift+Tab - should jump back to &quot;Input before tree&quot;
          </li>
          <li>
            To enter a focus group: click on any file/folder item, then use
            arrows
          </li>
        </ol>

        <h3>Focus Group Configuration</h3>
        <p>
          Each <code>&lt;Details&gt;</code> component is configured as:
        </p>
        <pre>
          <code>{`<Details
  focusGroup
  label="📁 Folder"
>
  <div className="content">
    {/* Content */}
  </div>
</Details>`}</code>
        </pre>
      </div>
    </div>
  );
};

// Mount the component
render(<TreeFocusTest />, document.body);
