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
  "DocumentFragment",
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
let walletAddress = "test-wallet";
let voteFailure = false;
let fail = false;
let renderFailure = false;
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
  if (id === "../../utils/grapeTools/Explorer") return { default: () => null, __esModule: true };
  if (id === "@solana/wallet-adapter-react")
    return {
      useWallet: () => ({
        publicKey: walletAddress ? { toBase58: () => walletAddress } : null,
      }),
    };
  if (
    id === "./ProposalPreviewBoundary" ||
    id === "./ProposalShare" ||
    id === "./VoterBreakdown" ||
    id === "./WalletActions" ||
    id === "./ProposalSettings" ||
    id === "./ProposalManagement" ||
    id === "./GrapeDaoNavigation" ||
    id === "./DaoPageLayout" ||
    id === "./proposalListStatus"
  ) {
    const file = path.resolve(`src/Governance/Demo/${id.slice(2)}.${id === "./proposalListStatus" ? "ts" : "tsx"}`);
    const child = new Module(file, module);
    child.require = loaded.require;
    child.filename = file;
    child.paths = Module._nodeModulePaths(path.dirname(file));
    child._compile(
      transformSync(fs.readFileSync(file, "utf8"), {
        filename: file,
        configFile: false,
        babelrc: false,
        presets: ["@babel/preset-typescript", "@babel/preset-react"],
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      }).code,
      file
    );
    return child.exports;
  }
  if (id === "../api/queries")
    return {
      getVoteRecordsByVoterIndexed: async () => {
        if (voteFailure) throw new Error("Unavailable");
        return [
          { account: { proposal: "active-proposal", isRelinquished: false, vote: { voteType: 0 } } },
          { account: { proposal: "closed-proposal", isRelinquished: true } },
        ];
      },
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
        if (renderFailure) throw new Error("Render failed");
        assert.equal(props.governanceAddress, realm);
        assert.equal(
          props.realm,
          undefined,
          "Allow proposal metadata and participant initialization"
        );
        return props.renderSimple({
          proposal: props.item,
          stateLabel: props.item.account.state === 2 ? "Voting" : "Completed",
          connected: true,
          timeline: [
            { key: "created", label: "Created", at: 1792400000 },
            { key: "voting", label: "Voting", at: 1792500000 },
            { key: "cooloff", label: "Cool off", at: 1792900000 },
            { key: "ends", label: "Ends", at: 1792903600 },
          ],
          hasVoted: true,
          hasVotedSide: "yes",
          approval: { progress: 100, target: "100", passing: true, surplus: "23", remaining: "0" },
          instructionCount: 2,
          assetSummary: [
            { mint: "grape-mint", name: "GRAPE", amount: 100, recipients: 1 },
          ],
          instructionDetails: [
            {
              description: "Transfer to grant recipient",
              amount: 100,
              name: "GRAPE",
              destinationAta: "recipient-token-account",
            },
          ],
          description: React.createElement(
            "p",
            null,
            "Loaded Gist proposal text"
          ),
          power: React.createElement(
            "p",
            null,
            "Own power 100 · Delegated to you 200"
          ),
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
    assert.ok(screen.getByText("100 target"));
    const timeline = screen.getByRole("list", { name: "Proposal timeline" });
    assert.equal(timeline.querySelectorAll("time").length, 4);
    assert.ok(timeline.textContent.includes("Cool off"));
    assert.ok(screen.getByText(/Passing · \+23 above target/));
    assert.equal(screen.getByRole("progressbar", { name: "Approval progress" }).getAttribute("aria-valuenow"), "100");
    assert.equal(
      screen.queryByRole("link", { name: /Return to Grape DAO/ }),
      null
    );
    assert.ok(screen.getByText("Loaded Gist proposal text"));
    assert.ok(screen.getByText(/Vote recorded · yes/));
    assert.ok(screen.getByText(/Own power 100/));
    assert.ok(
      screen.getByRole("heading", { name: "2 executable transactions" })
    );
    assert.ok(screen.getByText("100 GRAPE"));
    assert.equal(screen.queryByText(/Transfer to grant recipient/), null);
    assert.ok(
      screen.getByRole("button", {
        name: "Review instructions & recipient checks",
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review execution plan & risks",
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
    fireEvent.click(screen.getByRole("button", { name: "Proposal tools" }));
    assert.equal(
      screen
        .getByRole("link", { name: /Advanced proposal/ })
        .getAttribute("href"),
      `/proposal/${realm}/closed-proposal?view=advanced`
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

test("both demo URLs are active JSX routes, not commented-out declarations", () => {
  const ast = require("@babel/parser").parse(
    fs.readFileSync("src/App.tsx", "utf8"),
    {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    }
  );
  const routes = new Map();
  require("@babel/traverse").default(ast, {
    JSXOpeningElement({ node }) {
      if (node.name.type !== "JSXIdentifier" || node.name.name !== "Route")
        return;
      const pathAttr = node.attributes.find(
        (attr) => attr.name?.name === "path"
      );
      const elementAttr = node.attributes.find(
        (attr) => attr.name?.name === "element"
      );
      routes.set(
        pathAttr?.value?.value,
        elementAttr?.value?.expression?.openingElement?.name?.name
      );
    },
  });
  assert.equal(routes.get("/demo/governance"), "GovernanceDemo");
  assert.equal(routes.get(`/demo/governance/dao/${realm}`), "GovernanceDemo");
  assert.equal(routes.get("proposal/*"), "GovernanceProposalWrapper");
  assert.equal(routes.get(`dao/${realm}`), "GrapeDaoPage");
  assert.equal(routes.get(`proposal/${realm}/:proposal`), "GrapeDaoPage");
  assert.equal(routes.get(`governance/${realm}`), "GrapeDaoPage");
});

test("a proposal render error preserves the list and provides a working retry", async () => {
  const originalError = console.error;
  try {
    console.error = () => {};
    renderFailure = true;
    mount();
    assert.ok(await screen.findByRole("alert"));
    assert.ok(
      screen.getByRole("button", { name: /Existing treasury allocation/ })
    );
    renderFailure = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry proposal" }));
    assert.ok(
      await screen.findByRole("heading", { name: "Grape community grant" })
    );
  } finally {
    renderFailure = false;
    console.error = originalError;
    cleanup();
  }
});

test("sidebar distinguishes active votes, past proposals and wallet participation", async () => {
  try {
    mount();
    assert.ok(await screen.findByText("Voted For"));
    assert.ok(screen.getByText("Not voted"));
    assert.match(
      screen.getByRole("button", { name: /Grape community grant/ }).className,
      /is-voting/
    );
    assert.match(
      screen.getByRole("button", { name: /Existing treasury allocation/ })
        .className,
      /is-past/
    );
  } finally {
    cleanup();
  }
});
test("failed vote lookup is not presented as not voted", async () => {
  try {
    voteFailure = true;
    mount();
    assert.equal((await screen.findAllByText("Vote unavailable")).length, 2);
    assert.equal(screen.queryByText("Not voted"), null);
  } finally {
    voteFailure = false;
    cleanup();
  }
});

test("DAO landing and direct proposal URLs use simple view; advanced routes retain the old views", () => {
  const file = path.resolve("src/Governance/Demo/GrapeDaoPage.tsx");
  const page = new Module(file, module);
  page.filename = file;
  page.paths = Module._nodeModulePaths(path.dirname(file));
  page.require = function (id) {
    if (id === "./GovernanceDemo")
      return {
        __esModule: true,
        default: () => React.createElement("p", null, "Simple landing"),
      };
    if (id === "./DaoPageLayout" ||
    id === "./proposalListStatus")
      return {
        __esModule: true,
        default: ({ children }) => React.createElement("div", null, children),
      };
    if (id === "../Governance")
      return {
        GovernanceCachedView: (props) =>
          React.createElement(
            "p",
            null,
            `Advanced DAO ${props.governanceAddress}`
          ),
      };
    if (id === "../GovernanceProposalWrapper")
      return {
        GovernanceProposalWrapper: (props) =>
          React.createElement(
            "p",
            null,
            `Advanced proposal ${props.governanceAddress}`
          ),
      };
    return Module.prototype.require.call(this, id);
  };
  page._compile(
    transformSync(fs.readFileSync(file, "utf8"), {
      filename: file,
      configFile: false,
      babelrc: false,
      presets: ["@babel/preset-typescript", "@babel/preset-react"],
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }).code,
    file
  );
  const Page = page.exports.default;
  for (const [url, advanced, expected] of [
    [`/dao/${realm}`, false, "Simple landing"],
    [`/proposal/${realm}/proposal-id`, false, "Simple landing"],
    [
      `/proposal/${realm}/proposal-id?view=advanced`,
      false,
      `Advanced proposal ${realm}`,
    ],
    [`/governance/${realm}`, true, `Advanced DAO ${realm}`],
  ]) {
    try {
      render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [url] },
          React.createElement(Page, { advanced })
        )
      );
      assert.ok(screen.getByText(expected));
    } finally {
      cleanup();
    }
  }
});

test("no active votes shows recent decisions instead of auto-opening an old proposal", async () => {
  const previous = rows[1].account.state;
  try {
    rows[1].account.state = 5;
    mount();
    assert.ok(await screen.findByRole("heading", { name: "No active votes" }));
    assert.ok(screen.getByRole("heading", { name: "Recent decisions" }));
    assert.equal(
      screen.queryByRole("heading", { name: "Existing treasury allocation" }),
      null
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Existing treasury allocation/ })[0]
    );
    assert.ok(
      await screen.findByRole("heading", {
        name: "Existing treasury allocation",
      })
    );
    assert.equal(
      screen.queryByRole("heading", { name: "No active votes" }),
      null
    );
  } finally {
    rows[1].account.state = previous;
    cleanup();
  }
});

test('each DAO section shares one navigation and disables the legacy header/menu', () => {
  const file=path.resolve('src/Governance/Demo/GrapeDaoSection.tsx');
  const sectionModule=new Module(file,module);
  sectionModule.filename=file;sectionModule.paths=Module._nodeModulePaths(path.dirname(file));
  sectionModule.require=function(id){
    const names={'../GovernanceMembers':'GovernanceMembersView','../GovernanceTreasury':'GovernanceTreasuryView','../GovernanceStats':'GovernanceStatsView','../GovernanceReputation':'GovernanceReputationView'};
    if(names[id])return {[names[id]]:props=>{
      assert.equal(props.governanceAddress,realm);
      assert.equal(props.compactLayout,true);
      assert.equal(props.showGovernanceNavigation,false);
      return React.createElement('div',null,'Existing tools');
    }};
    return loaded.require(id);
  };
  sectionModule._compile(transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,file);
  for(const section of ['members','treasury','stats']){
    try {
      render(React.createElement(MemoryRouter,null,React.createElement(sectionModule.exports.default,{section})));
      assert.equal(screen.getAllByRole('navigation').length,1);
      assert.ok(screen.getByRole('heading',{name:section[0].toUpperCase()+section.slice(1)}));
      assert.equal(screen.getByRole('link',{name:section[0].toUpperCase()+section.slice(1)}).getAttribute('aria-current'),'page');
      assert.ok(screen.getByText('Existing tools'));
      assert.equal(screen.getByRole('link',{name:'Vine / OG Reputation ↗'}).getAttribute('href'),`https://vine.governance.so/dao/${realm}`);
      assert.match(screen.getByRole('link',{name:'Show old view'}).className,/gd-old-view/);
      assert.equal(screen.queryByText('Live DAO governance'),null);
    } finally {cleanup();}
  }
});


test("mobile starts with the list and opens each proposal in a dismissible panel", async () => {
  const previous = window.matchMedia;
  window.matchMedia = query => ({
    matches: query === "(max-width:950px)", media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  });
  try {
    mount();
    const first = await screen.findByRole("button", { name: /Grape community grant/ });
    assert.equal(screen.queryByRole("heading", { name: "Grape community grant" }), null);
    assert.equal(screen.queryByRole("dialog"), null);
    fireEvent.click(first);
    assert.ok(await screen.findByRole("dialog", { name: "Selected proposal" }));
    assert.ok(screen.getByRole("heading", { name: "Grape community grant" }));
    assert.ok(screen.getByRole("region", { name: "Proposal voting" }));
    assert.ok(screen.getByText("Voting controls unavailable"));
    fireEvent.click(screen.getByRole("button", { name: /Back to proposals/ }));
    await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
    fireEvent.click(screen.getByRole("button", { name: /Existing treasury allocation/ }));
    assert.ok(await screen.findByRole("heading", { name: "Existing treasury allocation" }));
    assert.ok(screen.getByText("Voting is closed"));
    assert.equal(screen.queryByRole("heading", { name: "Grape community grant" }), null);
  } finally {
    cleanup();
    window.matchMedia = previous;
  }
});
