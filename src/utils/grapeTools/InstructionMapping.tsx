// Follows realms standard in governance-ui repo

// Top level is the public key of the program
// second lvl is the first piece of data in the instruction, which is hte id of what the instruction is doing

export const InstructionMapping = {
    "11111111111111111111111111111111": {
      0: {
        name: "Create Account",
        accounts: [
          { name: "Funding Account", important: true },
          { name: "New Account", important: true },
        ],
      },
      1: {
        name: "Assign",
        accounts: [
          { name: "Account", important: true },
          { name: "Program Owner", important: true },
        ],
      },
      2: {
        name: "Sol Transfer",
        accounts: [
          { name: "Source", important: true },
          { name: "Destination", important: true },
          { name: "Authority" },
        ],
      },
      3: {
        name: "Create Account With Seed",
        accounts: [
          { name: "Funding Account", important: true },
          { name: "New Account", important: true },
        ],
      },
      4: { name: "Advance Nonce Account", accounts: [{ name: "Nonce Account", important: true }] },
      5: { name: "Withdraw Nonce Account", accounts: [{ name: "Nonce Account", important: true }, { name: "Destination", important: true }] },
      6: { name: "Initialize Nonce Account", accounts: [{ name: "Nonce Account", important: true }] },
      7: { name: "Authorize Nonce Account", accounts: [{ name: "Nonce Account", important: true }] },
      8: { name: "Allocate", accounts: [{ name: "Account", important: true }] },
      9: { name: "Allocate With Seed", accounts: [{ name: "Account", important: true }] },
      10: { name: "Assign With Seed", accounts: [{ name: "Account", important: true }] },
      11: { name: "Transfer With Seed", accounts: [{ name: "Source", important: true }, { name: "Destination", important: true }] },
    },
    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: {
      3: {
        name: "Token Transfer",
        accounts: [
          { name: "Source", important: true },
          { name: "Destination", important: true },
          { name: "Authority" },
        ],
      },
      4: {
        name: "Token Approve",
        accounts: [
          { name: "Source", important: true },
          { name: "Delegate", important: true },
          { name: "Owner" },
        ],
      },
      5: {
        name: "Token Revoke",
        accounts: [
          { name: "Source", important: true },
          { name: "Owner" },
        ],
      },
      6: {
        name: "Token Set Authority",
        accounts: [
          { name: "Account Or Mint", important: true },
          { name: "Current Authority", important: true },
        ],
      },
      12: {
        name: "Token Transfer Checked",
        accounts: [
          { name: "Source", important: true },
          { name: "Mint", important: true },
          { name: "Destination", important: true },
          { name: "Authority" },
        ],
      },
      13: {
        name: "Token Approve Checked",
        accounts: [
          { name: "Source", important: true },
          { name: "Mint", important: true },
          { name: "Delegate", important: true },
          { name: "Owner" },
        ],
      },
      7: {
        name: "Token MintTo",
        accounts: [
          { name: "Mint", important: true },
          { name: "Destination", important: true },
          { name: "Mint Authority" },
        ],
      },
      14: {
        name: "Token MintTo Checked",
        accounts: [
          { name: "Mint", important: true },
          { name: "Destination", important: true },
          { name: "Mint Authority" },
        ],
      },
      8: {
        name: "Token Burn",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Mint", important: true },
          { name: "Account Owner" },
        ],
      },
      15: {
        name: "Token Burn Checked",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Mint", important: true },
          { name: "Account Owner" },
        ],
      },
      9: {
        name: "Close Token Account",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Rent destination" },
          { name: "Account Owner" },
        ],
      },
      10: {
        name: "Freeze Token Account",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Mint", important: true },
          { name: "Authority" },
        ],
      },
      11: {
        name: "Thaw Token Account",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Mint", important: true },
          { name: "Authority" },
        ],
      },
      17: {
        name: "Sync Native",
        accounts: [
          { name: "Wrapped SOL Account", important: true },
        ],
      },
    },
    TokenzQdBNbLqP5VEh84bYQNJ9Y7fA1aC33mW7zk1g: {
      3: { name: "Token-2022 Transfer", accounts: [{ name: "Source", important: true }, { name: "Destination", important: true }, { name: "Authority" }] },
      4: { name: "Token-2022 Approve", accounts: [{ name: "Source", important: true }, { name: "Delegate", important: true }, { name: "Owner" }] },
      5: { name: "Token-2022 Revoke", accounts: [{ name: "Source", important: true }, { name: "Owner" }] },
      6: { name: "Token-2022 Set Authority", accounts: [{ name: "Account Or Mint", important: true }, { name: "Current Authority", important: true }] },
      7: { name: "Token-2022 MintTo", accounts: [{ name: "Mint", important: true }, { name: "Destination", important: true }, { name: "Mint Authority" }] },
      8: { name: "Token-2022 Burn", accounts: [{ name: "Token Account", important: true }, { name: "Mint", important: true }, { name: "Account Owner" }] },
      9: { name: "Token-2022 Close Account", accounts: [{ name: "Token Account", important: true }, { name: "Rent destination" }, { name: "Account Owner" }] },
      10: { name: "Token-2022 Freeze Account", accounts: [{ name: "Token Account", important: true }, { name: "Mint", important: true }, { name: "Authority" }] },
      11: { name: "Token-2022 Thaw Account", accounts: [{ name: "Token Account", important: true }, { name: "Mint", important: true }, { name: "Authority" }] },
      12: { name: "Token-2022 Transfer Checked", accounts: [{ name: "Source", important: true }, { name: "Mint", important: true }, { name: "Destination", important: true }, { name: "Authority" }] },
      13: { name: "Token-2022 Approve Checked", accounts: [{ name: "Source", important: true }, { name: "Mint", important: true }, { name: "Delegate", important: true }, { name: "Owner" }] },
      14: { name: "Token-2022 MintTo Checked", accounts: [{ name: "Mint", important: true }, { name: "Destination", important: true }, { name: "Mint Authority" }] },
      15: { name: "Token-2022 Burn Checked", accounts: [{ name: "Token Account", important: true }, { name: "Mint", important: true }, { name: "Account Owner" }] },
      17: { name: "Token-2022 Sync Native", accounts: [{ name: "Wrapped SOL Account", important: true }] },
    },
    MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: {
      34: {
        name: "Memo Program",
        accounts: [
          { name: "Authority" },
        ],
      },
    },
    DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M: {
      36: {
          name: "DCA Program by Jupiter",
          accounts: [
            { name: "Authority" },
          ],
      },
    },
    ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: {
      0: {
          name: "Create ATA",
          accounts: [
            { name: "Payer", important: true },
            { name: "ATA", important: true },
            { name: "Owner", important: true },
            { name: "Mint", important: true },
          ],
      },
      1: {
          name: "Create ATA Idempotent",
          accounts: [
            { name: "Payer", important: true },
            { name: "ATA", important: true },
            { name: "Owner", important: true },
            { name: "Mint", important: true },
          ],
      },
      2: {
          name: "Recover Nested ATA",
          accounts: [
            { name: "Nested ATA", important: true },
            { name: "Nested Mint", important: true },
          ],
      },
    },
  };
