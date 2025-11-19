import { describe, expect, it } from "vitest";
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
            maxLength: 4, // Max 4 since only 4 unique wallets
          }),
          (recipients) => {
            const tokenIds = new Set<string>();
            const mintedStudents = new Set<string>();

            for (const recipient of recipients) {
              // Skip if already minted for this student (one NFT per student)
              if (mintedStudents.has(recipient)) {
                continue;
              }

              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(recipient)],
                deployer
              );

              if (result.type === "ok") {
                const tokenId = (result as any).value.value.toString();
                // Each token ID should be unique
                expect(tokenIds.has(tokenId)).toBe(false);
                tokenIds.add(tokenId);
                mintedStudents.add(recipient);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Token IDs increment sequentially", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4 }), (numMints) => {
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

          // Use different wallets for each mint (one NFT per student)
          const wallets = [wallet1, wallet2, wallet3, wallet4];
          let actualMints = 0;
          
          for (let i = 0; i < numMints && i < wallets.length; i++) {
            // Check if this wallet already has an NFT
            const hasNft = simnet.callReadOnlyFn(
              "btc-university-nft",
              "has-nft",
              [Cl.principal(wallets[i])],
              deployer
            );
            
            const alreadyMinted = hasNft.result.type === "ok" && 
              hasNft.result.value.type === Cl.bool(true).type &&
              JSON.stringify(hasNft.result.value) === JSON.stringify(Cl.bool(true));
            
            if (!alreadyMinted) {
              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(wallets[i])],
                deployer
              );

              if (result.type === "ok") {
                actualMints++;
                const tokenId = Number((result as any).value.value);
                expect(tokenId).toBe(startingId + actualMints);
              }
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
            maxLength: 4,
          }),
          (recipients) => {
            const mintedStudents = new Set<string>();

            for (let i = 0; i < recipients.length; i++) {
              const recipient = recipients[i];

              // Skip if already minted for this student
              if (mintedStudents.has(recipient)) {
                continue;
              }

              // Mint NFT
              const mintResult = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(recipient)],
                deployer
              );

              if (mintResult.result.type === "ok") {
                const tokenId = Number((mintResult.result as any).value.value);
                mintedStudents.add(recipient);

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

    it("PROPERTY: last-token-id increases by number of unique students minted", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4 }), (numMints) => {
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

          // Mint tokens to different students (one NFT per student)
          const wallets = [wallet1, wallet2, wallet3, wallet4];
          let successfulMints = 0;
          
          for (let i = 0; i < numMints && i < wallets.length; i++) {
            // Check if wallet already has an NFT
            const hasNft = simnet.callReadOnlyFn(
              "btc-university-nft",
              "has-nft",
              [Cl.principal(wallets[i])],
              deployer
            );
            
            const alreadyMinted = hasNft.result.type === "ok" && 
              hasNft.result.value.type === Cl.bool(true).type &&
              JSON.stringify(hasNft.result.value) === JSON.stringify(Cl.bool(true));
            
            if (!alreadyMinted) {
              const result = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(wallets[i])],
                deployer
              );
              
              if (result.result.type === "ok") {
                successfulMints++;
              }
            }
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
          // Final ID should equal initial ID + number of successful mints
          expect(finalId).toBe(initialId + successfulMints);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe("Authorization Properties", () => {
    it("PROPERTY: Only instructors can mint", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (caller, recipient) => {
            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipient)],
              caller
            );

            // Should always fail for non-instructor
            expect(result.type).toBe("err");
            if (result.type === "err") {
              expect((result as any).value.value).toBe(100n); // ERR-INSTRUCTOR-ONLY
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it("PROPERTY: Deployer (default instructor) can mint successfully to unique students", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (recipient) => {
            // Check if student already has NFT BEFORE minting
            const hasNftBefore = simnet.callReadOnlyFn(
              "btc-university-nft",
              "has-nft",
              [Cl.principal(recipient)],
              deployer
            );

            const alreadyMinted = hasNftBefore.result.type === "ok" && 
              hasNftBefore.result.value.type === Cl.bool(true).type &&
              JSON.stringify(hasNftBefore.result.value) === JSON.stringify(Cl.bool(true));

            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipient)],
              deployer
            );

            if (alreadyMinted) {
              // Should fail with ERR-ALREADY-MINTED
              expect(result.type).toBe("err");
              if (result.type === "err") {
                expect((result as any).value.value).toBe(103n); // ERR-ALREADY-MINTED
              }
            } else {
              // Should succeed
              expect(result.type).toBe("ok");
              
              // Verify has-nft now returns true
              const hasNftAfter = simnet.callReadOnlyFn(
                "btc-university-nft",
                "has-nft",
                [Cl.principal(recipient)],
                deployer
              );
              expect(hasNftAfter.result.type).toBe("ok");
              expect(JSON.stringify((hasNftAfter.result as any).value)).toBe(JSON.stringify(Cl.bool(true)));
            }
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
      // Query high token IDs that are unlikely to be minted
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
            maxLength: 3,
          }),
          (recipients) => {
            // Mint NFTs (one per unique student)
            const mints: Array<{ tokenId: number; recipient: string }> = [];
            const mintedStudents = new Set<string>();

            for (const recipient of recipients) {
              if (mintedStudents.has(recipient)) {
                continue;
              }

              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(recipient)],
                deployer
              );

              if (result.type === "ok") {
                mints.push({
                  tokenId: Number((result as any).value.value),
                  recipient,
                });
                mintedStudents.add(recipient);
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
    // Mint a few tokens to different students
    const wallets = [wallet1, wallet2, wallet3];
    for (let i = 0; i < wallets.length; i++) {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallets[i])],
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

  it("FUZZ: Multiple attempts to mint to same recipient", () => {
    // First mint succeeds
    const result1 = simnet.callPublicFn(
      "btc-university-nft",
      "mint-for-student",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(result1.result.type).toBe("ok");
    if (result1.result.type === "ok") {
      expect(Number((result1.result as any).value.value)).toBe(1);
    }

    // All subsequent mints to same recipient fail
    for (let i = 2; i <= 10; i++) {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result.type).toBe("err");
      if (result.type === "err") {
        expect((result as any).value.value).toBe(103n); // ERR-ALREADY-MINTED
      }
    }

    // Verify last token ID is still 1 (only one successful mint)
    const { result } = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );

    expect(result.type).toBe("ok");
    expect(Number((result as any).value.value)).toBe(1);
  });

  it("FUZZ: Verify one NFT per student constraint", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (numAttempts) => {
        // Check if wallet1 already has an NFT from previous tests
        const hasNftInitial = simnet.callReadOnlyFn(
          "btc-university-nft",
          "has-nft",
          [Cl.principal(wallet1)],
          wallet1
        );
        const alreadyHadNft = hasNftInitial.result.type === "ok" && 
          hasNftInitial.result.value.type === Cl.bool(true).type &&
          JSON.stringify(hasNftInitial.result.value) === JSON.stringify(Cl.bool(true));

        let successfulMints = 0;
        let failedMints = 0;

        for (let i = 0; i < numAttempts; i++) {
          const { result } = simnet.callPublicFn(
            "btc-university-nft",
            "mint-for-student",
            [Cl.principal(wallet1)],
            deployer
          );

          if (result.type === "ok") {
            successfulMints++;
          } else if (result.type === "err") {
            failedMints++;
            // Should fail with ERR-ALREADY-MINTED
            expect((result as any).value.value).toBe(103n);
          }
        }

        if (alreadyHadNft) {
          // All mints should fail if already minted
          expect(successfulMints).toBe(0);
          expect(failedMints).toBe(numAttempts);
        } else {
          // Only first mint should succeed
          expect(successfulMints).toBe(1);
          expect(failedMints).toBe(numAttempts - 1);
        }

        // Verify wallet1 owns exactly one NFT
        const hasNft = simnet.callReadOnlyFn(
          "btc-university-nft",
          "has-nft",
          [Cl.principal(wallet1)],
          wallet1
        );
        expect(hasNft.result.type).toBe("ok");
        expect(JSON.stringify((hasNft.result as any).value)).toBe(JSON.stringify(Cl.bool(true)));
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
          minLength: 3,
          maxLength: 6,
        }),
        (recipients) => {
          let previousId = 0;
          const mintedStudents = new Set<string>();

          for (const recipient of recipients) {
            // Skip if already minted for this student
            if (!mintedStudents.has(recipient)) {
              simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(recipient)],
                deployer
              );
              mintedStudents.add(recipient);
            }

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

  it("INVARIANT: Token IDs are consecutive integers for unique students", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }), (numMints) => {
        const tokenIds: number[] = [];
        const wallets = [wallet1, wallet2, wallet3, wallet4];

        for (let i = 0; i < numMints && i < wallets.length; i++) {
          const { result } = simnet.callPublicFn(
            "btc-university-nft",
            "mint-for-student",
            [Cl.principal(wallets[i])],
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
          maxLength: 4,
        }),
        (recipients) => {
          const mintedStudents = new Set<string>();

          for (let i = 0; i < recipients.length; i++) {
            // Skip if already minted for this student
            if (mintedStudents.has(recipients[i])) {
              continue;
            }

            const mintResult = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipients[i])],
              deployer
            );

            if (mintResult.result.type === "ok") {
              const tokenId = Number((mintResult.result as any).value.value);
              mintedStudents.add(recipients[i]);

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

  it("INVARIANT: Minting increases last-token-id by exactly 1 per unique student", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet1, wallet2, wallet3), {
          minLength: 1,
          maxLength: 6,
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
          const mintedStudents = new Set<string>();

          for (const recipient of recipients) {
            // Skip if already minted for this student
            if (mintedStudents.has(recipient)) {
              continue;
            }

            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipient)],
              deployer
            );

            if (result.type === "ok") {
              successfulMints++;
              mintedStudents.add(recipient);
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
              "queryUri",
              "queryHasNft"
            ),
            recipient: fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
            queryId: fc.nat({ max: 50 }),
          }),
          { minLength: 10, maxLength: 30 }
        ),
        (operations) => {
          const mintedStudents = new Set<string>();

          for (const op of operations) {
            if (op.action === "mint") {
              const { result } = simnet.callPublicFn(
                "btc-university-nft",
                "mint-for-student",
                [Cl.principal(op.recipient)],
                deployer
              );
              // Should be ok if not already minted, err otherwise
              expect(["ok", "err"]).toContain(result.type);
              if (result.type === "ok") {
                mintedStudents.add(op.recipient);
              } else if (result.type === "err") {
                // If error, should be ERR-ALREADY-MINTED (u103)
                expect((result as any).value.value).toBe(103n);
              }
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
            } else if (op.action === "queryHasNft") {
              const { result } = simnet.callReadOnlyFn(
                "btc-university-nft",
                "has-nft",
                [Cl.principal(op.recipient)],
                wallet1
              );
              expect(result.type).toBe("ok");
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
          minLength: 4,
          maxLength: 12,
        }),
        (recipients) => {
          const minted: Array<{ tokenId: number; recipient: string }> = [];
          const mintedStudents = new Set<string>();

          for (const recipient of recipients) {
            // Skip if already minted for this student
            if (mintedStudents.has(recipient)) {
              continue;
            }

            const { result } = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipient)],
              deployer
            );

            if (result.type === "ok") {
              const tokenId = Number((result as any).value.value);
              minted.push({ tokenId, recipient });
              mintedStudents.add(recipient);
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
          minLength: 3,
          maxLength: 9,
        }),
        (recipients) => {
          const mintedStudents = new Set<string>();

          for (const recipient of recipients) {
            // Skip if already minted for this student
            if (mintedStudents.has(recipient)) {
              continue;
            }

            // Mint
            const mintResult = simnet.callPublicFn(
              "btc-university-nft",
              "mint-for-student",
              [Cl.principal(recipient)],
              deployer
            );

            if (mintResult.result.type === "ok") {
              const tokenId = Number((mintResult.result as any).value.value);
              mintedStudents.add(recipient);

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
  it("STRESS: Rapid consecutive mints to unique students", () => {
    const recipients = [wallet1, wallet2, wallet3, wallet4];
    const mintedStudents = new Set<string>();
    let successfulMints = 0;

    // Try to mint 50 times, but only 4 should succeed (one per student)
    for (let i = 0; i < 50; i++) {
      const recipient = recipients[i % recipients.length];
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(recipient)],
        deployer
      );

      if (result.type === "ok") {
        expect(mintedStudents.has(recipient)).toBe(false);
        mintedStudents.add(recipient);
        successfulMints++;
      } else {
        // Should fail with ERR-ALREADY-MINTED
        expect((result as any).value.value).toBe(103n);
      }
    }

    // Only 4 mints should succeed (one per unique student)
    expect(successfulMints).toBe(recipients.length);

    // Verify final state
    const { result } = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );

    expect(result.type).toBe("ok");
    expect(Number((result as any).value.value)).toBe(recipients.length);
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
              "queryUri",
              "queryHasNft"
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
                // May succeed or fail with ERR-ALREADY-MINTED
                simnet.callPublicFn(
                  "btc-university-nft",
                  "mint-for-student",
                  [Cl.principal(op.recipient)],
                  deployer
                );
              } else if (op.operation === "mintAsWallet") {
                // Should fail with ERR-INSTRUCTOR-ONLY (unless caller is deployer)
                simnet.callPublicFn(
                  "btc-university-nft",
                  "mint-for-student",
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
              } else if (op.operation === "queryHasNft") {
                simnet.callReadOnlyFn(
                  "btc-university-nft",
                  "has-nft",
                  [Cl.principal(op.recipient)],
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
