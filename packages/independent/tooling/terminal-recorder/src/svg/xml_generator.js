import he from "he";

export const encodeTextContent = (content) => {
  return he.encode(content, {
    decimal: false,
  });
};

export const createXmlGenerator = ({
  rootNodeName,
  canSelfCloseNames = [],
  canReceiveChildNames = [],
  canReceiveContentNames = [],
  canInjectWhitespacesAroundContentNames = [],
}) => {
  const createNode = (name, attributes = {}) => {
    const canSelfClose = canSelfCloseNames.includes(name);
    const canReceiveChild = canReceiveChildNames.includes(name);
    const canReceiveContent = canReceiveContentNames.includes(name);
    const canInjectWhitespacesAroundContent =
      canInjectWhitespacesAroundContentNames.includes(name);

    const children = [];

    const node = {
      name,
      content: "",
      contentIsSafe: false,
      children,
      attributes,
      canSelfClose,
      createNode,
      appendChild: (childNode) => {
        if (!canReceiveChild) {
          throw new Error(`cannot appendChild into ${name}`);
        }
        children.push(childNode);
        return childNode;
      },
      setContent: (value, isSafe = false) => {
        if (!canReceiveContent) {
          throw new Error(`cannot setContent on ${name}`);
        }
        node.content = value;
        node.contentIsSafe = isSafe;
      },
      renderAsString: () => {
        const renderNode = (node, { depth }) => {
          let nodeString = "";
          nodeString += `<${node.name}`;

          write_attributes: {
            const attributeNames = Object.keys(node.attributes);
            if (attributeNames.length) {
              let attributesSingleLine = "";
              let attributesMultiLine = "";

              for (const attributeName of attributeNames) {
                let attributeValue = node.attributes[attributeName];
                if (attributeValue === undefined) {
                  continue;
                }
                if (typeof attributeValue === "number") {
                  attributeValue = round(attributeValue);
                }
                if (attributeName === "viewBox") {
                  attributeValue = attributeValue
                    .split(" ")
                    .map((v) => round(parseFloat(v.trim())))
                    .join(" ");
                }
                attributesSingleLine += ` ${attributeName}="${attributeValue}"`;
                attributesMultiLine += `\n  `;
                attributesMultiLine += "  ".repeat(depth);
                attributesMultiLine += `${attributeName}="${attributeValue}"`;
              }
              attributesMultiLine += "\n";
              attributesMultiLine += "  ".repeat(depth);

              if (attributesSingleLine.length < 100) {
                nodeString += attributesSingleLine;
              } else {
                nodeString += attributesMultiLine;
              }
            }
          }

          let innerHTML = "";
          if (node.content) {
            if (canInjectWhitespacesAroundContent) {
              innerHTML += "\n  ";
              innerHTML += "  ".repeat(depth);
            }
            if (node.contentIsSafe) {
              innerHTML += node.content;
            } else {
              const contentEncoded = encodeTextContent(node.content);
              innerHTML += contentEncoded;
            }
            if (canInjectWhitespacesAroundContent) {
              innerHTML += "\n";
              innerHTML += "  ".repeat(depth);
            }
          }
          write_children: {
            if (node.children.length > 0) {
              for (const child of node.children) {
                innerHTML += "\n  ";
                innerHTML += "  ".repeat(depth);
                innerHTML += renderNode(child, {
                  depth: depth + 1,
                });
              }
              innerHTML += "\n";
              innerHTML += "  ".repeat(depth);
            }
          }
          if (innerHTML === "") {
            if (node.canSelfClose) {
              nodeString += `/>`;
            } else {
              nodeString += `></${node.name}>`;
            }
          } else {
            nodeString += `>`;
            nodeString += innerHTML;
            nodeString += `</${node.name}>`;
          }
          return nodeString;
        };

        return renderNode(node, {
          depth: 0,
        });
      },
    };

    return node;
  };

  return (rootNodeAttributes) => createNode(rootNodeName, rootNodeAttributes);
};

export const createSvgRootNode = createXmlGenerator({
  rootNodeName: "svg",
  canSelfCloseNames: ["path", "rect", "circle"],
  canReceiveChildNames: ["svg", "foreignObject", "g"],
  canReceiveContentNames: ["text", "tspan", "style"],
  canInjectWhitespacesAroundContentNames: ["style"],
});

// not used for now and needs to configure canReceiveChildNames and so on...
export const createXmlRootNode = createXmlGenerator({
  rootNodeName: "xml",
});

// not used for now and needs to configure canReceiveChildNames and so on...
export const createHtmlRootNode = createXmlGenerator({
  rootNodeName: "html",
});

// Round: Make number values smaller in output
// Eg: 14.23734 becomes 14.24
// Credit @Chris Martin: https://stackoverflow.com/a/43012696/2816869
const round = (x) => {
  const rounded = Number(`${Math.round(`${x}e2`)}e-2`);
  return rounded;
};
