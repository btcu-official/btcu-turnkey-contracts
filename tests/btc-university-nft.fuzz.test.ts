import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import * as fc from "fast-check";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

// ==============================
// PROPERTY-BASED FUZZ TESTS
// ==============================

describe("NFT Property-Based Fuzz Tests", () => {
  describe("Mint Properties", () => {
    it("PROPERTY: Each mint produces unique token ID", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(wallet1, wallet2, wallet3, wallet4), {
            minLength: 1,
            maxLength: 20,
          }),
          (recipients) => {
            const tokenIds = new Set<string>();

            for (const recipient of recipients) {
              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint",
                [Cl.principal(recipient)],
                deployer
              );

              if (result.type === "ok") {
                const tokenId = (result as any).value.value.toString();
                // Each token ID should be unique
                expect(tokenIds.has(tokenId)).toBe(false);
                tokenIds.add(tokenId);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Token IDs increment sequentially", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 50 }), (numMints) => {
          // Get the starting token ID (state may persist from previous tests)
          const initialIdResult = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );
          const startingId =
            initialIdResult.result.type === "ok"
              ? Number((initialIdResult.result as any).value.value)
              : 0;

          for (let i = 1; i <= numMints; i++) {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(wallet1)],
              deployer
            );

            if (result.type === "ok") {
              const tokenId = Number((result as any).value.value);
              expect(tokenId).toBe(startingId + i);
            }
          }
        }),
        { numRuns: 5 }
      );
    });

    it("PROPERTY: Minted NFT owner is always the recipient", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(wallet1, wallet2, wallet3, wallet4), {
            minLength: 1,
            maxLength: 10,
          }),
          (recipients) => {
            for (let i = 0; i < recipients.length; i++) {
              const recipient = recipients[i];

              // Mint NFT
              const mintResult = simnet.callPublicFn(
                "btc-university-nft",
                "mint",
                [Cl.principal(recipient)],
                deployer
              );

              if (mintResult.result.type === "ok") {
                const tokenId = Number((mintResult.result as any).value.value);

                // Check owner
                const ownerResult = simnet.callReadOnlyFn(
                  "btc-university-nft",
                  "get-owner",
                  [Cl.uint(tokenId)],
                  wallet1
                );

                expect(ownerResult.result.type).toBe("ok");
                const ownerValue = (ownerResult.result as any).value;
                if (ownerValue.type === "some") {
                  const owner = ownerValue.value.value;
                  expect(owner).toBe(recipient);
                }
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: last-token-id increases by number of mints", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 30 }), (numMints) => {
          // Get initial token ID
          const initialResult = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );
          const initialId =
            initialResult.result.type === "ok"
              ? Number((initialResult.result as any).value.value)
              : 0;

          // Mint tokens
          for (let i = 0; i < numMints; i++) {
            simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(wallet1)],
              deployer
            );
          }

          // Get final token ID
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );

          expect(result.type).toBe("ok");
          const finalId = Number((result as any).value.value);
          // Final ID should equal initial ID + number of mints
          expect(finalId).toBe(initialId + numMints);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe("Authorization Properties", () => {
    it("PROPERTY: Only deployer can mint", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (caller, recipient) => {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              caller
            );

            // Should always fail for non-deployer
            expect(result.type).toBe("err");
            if (result.type === "err") {
              expect((result as any).value.value).toBe(100n); // err-owner-only
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it("PROPERTY: Deployer can always mint successfully", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (recipient) => {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              deployer
            );

            expect(result.type).toBe("ok");
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Read Function Properties", () => {
    it("PROPERTY: get-token-uri always returns none", () => {
      fc.assert(
        fc.property(fc.nat({ max: 1000 }), (tokenId) => {
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-token-uri",
            [Cl.uint(tokenId)],
            wallet1
          );

          expect(result.type).toBe("ok");
          expect((result as any).value.type).toBe("none");
        }),
        { numRuns: 30 }
      );
    });

    it("PROPERTY: get-owner returns none for unminted tokens", () => {
      // Mint a few tokens first
      for (let i = 0; i < 5; i++) {
        simnet.callPublicFn(
          "btc-university-nft",
          "mint",
          [Cl.principal(wallet1)],
          deployer
        );
      }

      fc.assert(
        fc.property(fc.integer({ min: 100, max: 1000 }), (unmintedId) => {
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-owner",
            [Cl.uint(unmintedId)],
            wallet1
          );

          expect(result.type).toBe("ok");
          expect((result as any).value.type).toBe("none");
        }),
        { numRuns: 20 }
      );
    });

    it("PROPERTY: get-owner returns some for minted tokens", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(wallet1, wallet2, wallet3), {
            minLength: 1,
            maxLength: 10,
          }),
          (recipients) => {
            // Mint NFTs
            const mints: Array<{ tokenId: number; recipient: string }> = [];
            for (const recipient of recipients) {
              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint",
                [Cl.principal(recipient)],
                deployer
              );

              if (result.type === "ok") {
                mints.push({
                  tokenId: Number((result as any).value.value),
                  recipient,
                });
              }
            }

            // Check all minted tokens
            for (const mint of mints) {
              const { result } = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-owner",
                [Cl.uint(mint.tokenId)],
                wallet1
              );

              expect(result.type).toBe("ok");
              expect((result as any).value.type).toBe("some");
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});

// ==============================
// BOUNDARY VALUE FUZZ TESTS
// ==============================

describe("NFT Boundary Value Fuzz Tests", () => {
  it("FUZZ: Extreme token ID queries", () => {
    // Mint a few tokens
    for (let i = 0; i < 3; i++) {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint",
        [Cl.principal(wallet1)],
        deployer
      );
    }

    const extremeValues = [
      0,
      1,
      2,
      3,
      4,
      100,
      1000,
      10000,
      Number.MAX_SAFE_INTEGER,
    ];

    extremeValues.forEach((tokenId) => {
      // Query owner
      const ownerResult = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(tokenId)],
        wallet1
      );
      expect(ownerResult.result.type).toBe("ok");

      // Query URI
      const uriResult = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(tokenId)],
        wallet1
      );
      expect(uriResult.result.type).toBe("ok");
    });
  });

  it("FUZZ: Large number of sequential mints", () => {
    const largeNumber = 100;

    for (let i = 0; i < largeNumber; i++) {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result.type).toBe("ok");
      if (result.type === "ok") {
        expect(Number((result as any).value.value)).toBe(i + 1);
      }
    }

    // Verify last token ID
    const { result } = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );

    expect(result.type).toBe("ok");
    expect(Number((result as any).value.value)).toBe(largeNumber);
  });

  it("FUZZ: Mint to same recipient multiple times", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (numMints) => {
        const tokenIds: number[] = [];

        for (let i = 0; i < numMints; i++) {
          const { result } = simnet.callPublicFn(
            "btc-university-nft",
            "mint",
            [Cl.principal(wallet1)],
            deployer
          );

          if (result.type === "ok") {
            tokenIds.push(Number((result as any).value.value));
          }
        }

        // Verify all token IDs are unique
        const uniqueIds = new Set(tokenIds);
        expect(uniqueIds.size).toBe(tokenIds.length);

        // Verify all belong to wallet1
        for (const tokenId of tokenIds) {
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-owner",
            [Cl.uint(tokenId)],
            wallet1
          );

          expect(result.type).toBe("ok");
          const owner = (result as any).value;
          if (owner.type === "some") {
            expect(owner.value.value).toBe(wallet1);
          }
        }
      }),
      { numRuns: 10 }
    );
  });
});

// ==============================
// INVARIANT FUZZ TESTS
// ==============================

describe("NFT Invariant Fuzz Tests", () => {
  it("INVARIANT: last-token-id never decreases", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3), {
          minLength: 5,
          maxLength: 20,
        }),
        (recipients) => {
          let previousId = 0;

          for (const recipient of recipients) {
            simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              deployer
            );

            const { result } = simnet.callReadOnlyFn(
              "btc-university-nft",
              "get-last-token-id",
              [],
              wallet1
            );

            if (result.type === "ok") {
              const currentId = Number((result as any).value.value);
              expect(currentId).toBeGreaterThanOrEqual(previousId);
              previousId = currentId;
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("INVARIANT: Token IDs are consecutive integers", () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 30 }), (numMints) => {
        const tokenIds: number[] = [];

        for (let i = 0; i < numMints; i++) {
          const { result } = simnet.callPublicFn(
            "btc-university-nft",
            "mint",
            [Cl.principal(wallet1)],
            deployer
          );

          if (result.type === "ok") {
            tokenIds.push(Number((result as any).value.value));
          }
        }

        // Check they form a consecutive sequence (each ID is previous + 1)
        for (let i = 1; i < tokenIds.length; i++) {
          expect(tokenIds[i]).toBe(tokenIds[i - 1] + 1);
        }
      }),
      { numRuns: 10 }
    );
  });

  it("INVARIANT: Each minted token has exactly one owner", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3, wallet4), {
          minLength: 1,
          maxLength: 15,
        }),
        (recipients) => {
          for (let i = 0; i < recipients.length; i++) {
            const mintResult = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipients[i])],
              deployer
            );

            if (mintResult.result.type === "ok") {
              const tokenId = Number((mintResult.result as any).value.value);

              // Check from multiple callers - should always return same owner
              const owner1 = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-owner",
                [Cl.uint(tokenId)],
                wallet1
              );

              const owner2 = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-owner",
                [Cl.uint(tokenId)],
                wallet2
              );

              expect(owner1.result.type).toBe("ok");
              expect(owner2.result.type).toBe("ok");

              // Both queries should return the same owner
              const owner1Value = JSON.stringify((owner1.result as any).value);
              const owner2Value = JSON.stringify((owner2.result as any).value);
              expect(owner1Value).toBe(owner2Value);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("INVARIANT: Minting increases last-token-id by exactly 1", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3), {
          minLength: 1,
          maxLength: 25,
        }),
        (recipients) => {
          // Get initial last-token-id
          const initialResult = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );
          const initialId =
            initialResult.result.type === "ok"
              ? Number((initialResult.result as any).value.value)
              : 0;

          let successfulMints = 0;

          for (const recipient of recipients) {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              deployer
            );

            if (result.type === "ok") {
              successfulMints++;
            }
          }

          // Get final last-token-id
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );

          expect(result.type).toBe("ok");
          const finalId = Number((result as any).value.value);
          // Final ID should equal initial ID + number of successful mints
          expect(finalId).toBe(initialId + successfulMints);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ==============================
// SEQUENCE-BASED FUZZ TESTS
// ==============================

describe("NFT Sequence-Based Fuzz Tests", () => {
  it("FUZZ: Random mint and query sequence", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            action: fc.constantFrom(
              "mint",
              "queryOwner",
              "queryId",
              "queryUri"
            ),
            recipient: fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
            queryId: fc.nat({ max: 50 }),
          }),
          { minLength: 10, maxLength: 30 }
        ),
        (operations) => {
          for (const op of operations) {
            if (op.action === "mint") {
              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint",
                [Cl.principal(op.recipient)],
                deployer
              );
              expect(["ok", "err"]).toContain(result.type);
            } else if (op.action === "queryOwner") {
              const { result } = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-owner",
                [Cl.uint(op.queryId)],
                wallet1
              );
              expect(result.type).toBe("ok");
            } else if (op.action === "queryId") {
              const { result } = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-last-token-id",
                [],
                wallet1
              );
              expect(result.type).toBe("ok");
            } else if (op.action === "queryUri") {
              const { result } = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-token-uri",
                [Cl.uint(op.queryId)],
                wallet1
              );
              expect(result.type).toBe("ok");
              expect((result as any).value.type).toBe("none");
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("FUZZ: Interleaved mints to different recipients", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3, wallet4), {
          minLength: 10,
          maxLength: 30,
        }),
        (recipients) => {
          const minted: Array<{ tokenId: number; recipient: string }> = [];

          for (const recipient of recipients) {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              deployer
            );

            if (result.type === "ok") {
              const tokenId = Number((result as any).value.value);
              minted.push({ tokenId, recipient });
            }
          }

          // Verify all minted NFTs have correct owners
          for (const { tokenId, recipient } of minted) {
            const { result } = simnet.callReadOnlyFn(
              "btc-university-nft",
              "get-owner",
              [Cl.uint(tokenId)],
              wallet1
            );

            expect(result.type).toBe("ok");
            const owner = (result as any).value;
            if (owner.type === "some") {
              expect(owner.value.value).toBe(recipient);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("FUZZ: Concurrent-style operations (mint + immediate query)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3), {
          minLength: 5,
          maxLength: 15,
        }),
        (recipients) => {
          for (const recipient of recipients) {
            // Mint
            const mintResult = simnet.callPublicFn(
              "btc-university-nft",
              "mint",
              [Cl.principal(recipient)],
              deployer
            );

            if (mintResult.result.type === "ok") {
              const tokenId = Number((mintResult.result as any).value.value);

              // Immediately query owner
              const ownerResult = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-owner",
                [Cl.uint(tokenId)],
                wallet1
              );

              expect(ownerResult.result.type).toBe("ok");
              const owner = (ownerResult.result as any).value;
              expect(owner.type).toBe("some");
              if (owner.type === "some") {
                expect(owner.value.value).toBe(recipient);
              }

              // Immediately query last ID
              const lastIdResult = simnet.callReadOnlyFn(
                "btc-university-nft",
                "get-last-token-id",
                [],
                wallet1
              );

              expect(lastIdResult.result.type).toBe("ok");
              const lastId = Number((lastIdResult.result as any).value.value);
              expect(lastId).toBe(tokenId);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ==============================
// STRESS & CHAOS TESTS
// ==============================

describe("NFT Stress & Chaos Tests", () => {
  it("STRESS: Rapid consecutive mints", () => {
    const recipients = [wallet1, wallet2, wallet3, wallet4];
    const numMints = 50;

    for (let i = 0; i < numMints; i++) {
      const recipient = recipients[i % recipients.length];
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint",
        [Cl.principal(recipient)],
        deployer
      );

      expect(result.type).toBe("ok");
    }

    // Verify final state
    const { result } = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );

    expect(result.type).toBe("ok");
    expect(Number((result as any).value.value)).toBe(numMints);
  });

  it("CHAOS: Random mix of all operations", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            operation: fc.constantFrom(
              "mintAsDeployer",
              "mintAsWallet",
              "queryOwner",
              "queryLastId",
              "queryUri"
            ),
            recipient: fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
            caller: fc.constantFrom(
              deployer,
              wallet1,
              wallet2,
              wallet3,
              wallet4
            ),
            tokenId: fc.nat({ max: 100 }),
          }),
          { minLength: 20, maxLength: 50 }
        ),
        (operations) => {
          for (const op of operations) {
            try {
              if (op.operation === "mintAsDeployer") {
                simnet.callPublicFn(
                  "btc-university-nft",
                  "mint",
                  [Cl.principal(op.recipient)],
                  deployer
                );
              } else if (op.operation === "mintAsWallet") {
                // Should fail
                simnet.callPublicFn(
                  "btc-university-nft",
                  "mint",
                  [Cl.principal(op.recipient)],
                  op.caller
                );
              } else if (op.operation === "queryOwner") {
                simnet.callReadOnlyFn(
                  "btc-university-nft",
                  "get-owner",
                  [Cl.uint(op.tokenId)],
                  op.caller
                );
              } else if (op.operation === "queryLastId") {
                simnet.callReadOnlyFn(
                  "btc-university-nft",
                  "get-last-token-id",
                  [],
                  op.caller
                );
              } else if (op.operation === "queryUri") {
                simnet.callReadOnlyFn(
                  "btc-university-nft",
                  "get-token-uri",
                  [Cl.uint(op.tokenId)],
                  op.caller
                );
              }
            } catch (e) {
              // Some operations will fail, that's expected
            }
          }

          // Final state should still be consistent
          const { result } = simnet.callReadOnlyFn(
            "btc-university-nft",
            "get-last-token-id",
            [],
            wallet1
          );
          expect(result.type).toBe("ok");
        }
      ),
      { numRuns: 5 }
    );
  });
});
