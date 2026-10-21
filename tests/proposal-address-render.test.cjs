const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const { PublicKey } = require("@solana/web3.js");

test("actual description fallback expressions render string and PublicKey proposal addresses", () => {
  const filename = "src/Governance/GovernanceProposalV2.tsx";
  const ast = babel.parseSync(fs.readFileSync(filename, "utf8"), {
    filename,
    configFile: false,
    babelrc: false,
    presets: ["@babel/preset-typescript", "@babel/preset-react"],
  });
  let helper;
  const expressions = [];
  traverse(ast, {
    FunctionDeclaration({ node }) {
      if (node.id.name === "toBase58Safe") helper = node;
    },
    JSXOpeningElement({ node }) {
      if (node.name.name !== "RenderDescription") return;
      const fallback = node.attributes.find(
        (attr) => attr.name?.name === "fallback"
      );
      if (fallback) expressions.push(fallback.value.expression);
    },
  });
  assert.equal(expressions.length, 2);
  const helperJs = babel.transformFromAstSync(
    {
      type: "File",
      program: {
        type: "Program",
        sourceType: "module",
        body: [helper],
        directives: [],
      },
    },
    "",
    {
      filename,
      configFile: false,
      babelrc: false,
      presets: ["@babel/preset-typescript"],
    }
  ).code;
  const address = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
  for (const expression of expressions) {
    const renderFallback = new Function(
      "proposalPk",
      `${helperJs}; return ${generate(expression).code}`
    );
    assert.equal(renderFallback(address), address);
    assert.equal(renderFallback(new PublicKey(address)), address);
    assert.equal(renderFallback(undefined), "");
  }
});
