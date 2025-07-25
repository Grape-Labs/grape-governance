// Follows realms standard in governance-ui repo

// Top level is the public key of the program
// second lvl is the first piece of data in the instruction, which is hte id of what the instruction is doing

export const InstructionMapping = {
    "11111111111111111111111111111111": {
      2: {
        name: "Sol Transfer",
        accounts: [
          { name: "Source", important: true },
          { name: "Destination", important: true },
          { name: "Authority" },
        ],
      },
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
      7: {
        name: "Token MintTo",
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
      9: {
        name: "Close Token Account",
        accounts: [
          { name: "Token Account", important: true },
          { name: "Rent destination" },
          { name: "Account Owner" },
        ],
      },
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
      1: {
          name: "ATA Program",
          accounts: [
            { name: "Authority" },
          ],
      },
    },
  };