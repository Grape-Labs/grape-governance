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
let fail = false;
const realm = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
const rows = [
  {
    pubkey: "closed-proposal",
    account: { name: "Existing treasury allocation", state: 5, draftAt: 200 },
  },
  {
    pubkey: "active-proposal",
    account: { name: "Grape community grant", state: 2, draftAt: 100 },
  },
];
loaded.require = function (id) {
  if (id.endsWith(".css")) return {};
  if (id === "../api/queries")
    return {
      getRealmIndexed: async (address) => {
        assert.equal(address, realm);
        if (fail) throw new Error("RPC unavailable");
        return { owner: "program" };
      },
      getAllGovernancesIndexed: async () => [{ pubkey: "rules" }],
      getAllProposalsIndexed: async (rules, owner, address) => {
        assert.deepEqual(rules, ["rules"]);
        assert.equal(address, realm);
        return rows;
      },
    };
  if (id === "../GovernanceProposalV2")
    return {
      GovernanceProposalV2View: (props) => {
        assert.equal(props.governanceAddress, realm);
        return props.renderSimple({
          proposal: props.item,
          stateLabel: props.item.account.state === 2 ? "Voting" : "Completed",
          forVotes: "123",
          againstVotes: "45",
          forPct: 73,
          totalCastUi: 168,
          details: React.createElement(
            "p",
            null,
            "Existing instruction review"
          ),
        });
      },
    };
  return Module.prototype.require.call(this, id);
};
loaded._compile(compiled, filename);
const Demo = loaded.exports.default;
const { MemoryRouter } = require("react-router-dom");
const { waitFor } = require("@testing-library/react");
const mount = () =>
  render(React.createElement(MemoryRouter, null, React.createElement(Demo)));
test("loads actual realm proposals, prioritizes active votes, and preserves the original review", async () => {
  try {
    mount();
    assert.ok(
      await screen.findByRole("heading", { name: "Grape community grant" })
    );
    assert.ok(screen.getByText("123"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review full proposal & instructions",
      })
    );
    assert.ok(screen.getByText("Existing instruction review"));
    fireEvent.click(
      screen.getByRole("button", { name: /Existing treasury allocation/ })
    );
    assert.ok(
      screen.getByRole("heading", { name: "Existing treasury allocation" })
    );
    assert.equal(screen.queryByText("Existing instruction review"), null);
    assert.equal(
      screen.getByRole("link", { name: /Original page/ }).getAttribute("href"),
      `/proposal/${realm}/closed-proposal`
    );
  } finally {
    cleanup();
  }
});
test("shows RPC errors and recovers on retry without fictitious fallback data", async () => {
  try {
    fail = true;
    mount();
    assert.ok(await screen.findByRole("alert"));
    assert.ok(screen.getByText("RPC unavailable"));
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    assert.ok(
      await screen.findByRole("heading", { name: "Grape community grant" })
    );
  } finally {
    fail = false;
    cleanup();
  }
});

test('both demo URLs are active JSX routes, not commented-out declarations', () => {
  const ast = require('@babel/parser').parse(fs.readFileSync('src/App.tsx', 'utf8'), {
    sourceType: 'module', plugins: ['typescript', 'jsx'],
  });
  const routes = new Map();
  require('@babel/traverse').default(ast, {
    JSXOpeningElement({node}) {
      if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Route') return;
      const pathAttr = node.attributes.find(attr => attr.name?.name === 'path');
      const elementAttr = node.attributes.find(attr => attr.name?.name === 'element');
      routes.set(pathAttr?.value?.value, elementAttr?.value?.expression?.openingElement?.name?.name);
    },
  });
  assert.equal(routes.get('/demo/governance'), 'GovernanceDemo');
  assert.equal(routes.get(`/demo/governance/dao/${realm}`), 'GovernanceDemo');
  assert.equal(routes.get('proposal/*'), 'GovernanceProposalWrapper');
});
