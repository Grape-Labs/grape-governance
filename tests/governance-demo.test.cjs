const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const { transformSync } = require("@babel/core");
const dom = new JSDOM("<html><body></body></html>", {
  url: "https://governance.so/demo/governance",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "Event",
  "MouseEvent",
])
  global[key] = dom.window[key];
global.navigator = dom.window.navigator;
const React = require("react");
const {
  render,
  fireEvent,
  screen,
  cleanup,
} = require("@testing-library/react");
const filename = path.resolve("src/Governance/Demo/GovernanceDemo.tsx");
const compiled = transformSync(fs.readFileSync(filename, "utf8"), {
  filename,
  configFile: false,
  babelrc: false,
  presets: ["@babel/preset-typescript", "@babel/preset-react"],
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded.require = function (id) {
  return id.endsWith(".css") ? {} : Module.prototype.require.call(this, id);
};
loaded._compile(compiled, filename);
const Demo = loaded.exports.default;

test("requires a choice, allows review changes, and shows approval without moving tokens", () => {
  try {
    render(React.createElement(Demo));
    assert.equal(
      screen.getByRole("button", { name: /Review my choice/ }).disabled,
      true
    );
    fireEvent.click(screen.getByRole("radio", { name: /YES/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review my choice/ }));
    assert.ok(screen.getByText("YES · Buy SOL"));
    fireEvent.click(screen.getByRole("button", { name: "Change choice" }));
    assert.equal(screen.getByRole("radio", { name: /YES/ }).checked, true);
    fireEvent.click(screen.getByRole("radio", { name: /NO/ }));
    fireEvent.click(screen.getByRole("button", { name: /Review my choice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm demo vote/ }));
    assert.ok(screen.getByRole("heading", { name: "Proposal approved" }));
    assert.ok(screen.getByText("NO · 1,000 votes"));
    assert.ok(screen.getByText("Unchanged"));
    assert.match(
      screen.getByText(/An authorized execution/).textContent,
      /Approval alone does not move/
    );
  } finally {
    cleanup();
  }
});

test("scenario changes reset the choice and both failure outcomes explain why funds stay put", () => {
  try {
    render(React.createElement(Demo));
    for (const [scenario, outcome] of [
      ["Buy ZEC", "Participation target not reached"],
      ["Buy BTC", "Proposal rejected"],
    ]) {
      fireEvent.click(
        screen.getByRole("button", { name: new RegExp(scenario) })
      );
      assert.equal(
        screen.getByRole("button", { name: /Review my choice/ }).disabled,
        true
      );
      fireEvent.click(screen.getByRole("radio", { name: /YES/ }));
      fireEvent.click(screen.getByRole("button", { name: /Review my choice/ }));
      fireEvent.click(
        screen.getByRole("button", { name: /Confirm demo vote/ })
      );
      assert.ok(screen.getByRole("heading", { name: outcome }));
      assert.ok(screen.getByText(/The treasury keeps its funds/));
    }
    fireEvent.click(screen.getByRole("button", { name: /Next scenario/ }));
    assert.ok(screen.getByRole("heading", { name: "Should the DAO buy SOL?" }));
    assert.equal(
      screen.getByRole("button", { name: /Review my choice/ }).disabled,
      true
    );
  } finally {
    cleanup();
  }
});
