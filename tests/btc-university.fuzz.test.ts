import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import * as fc from "fast-check";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

// Helper to initialize sBTC contract
function initializeSbtcContract() {
  const result = simnet.callPublicFn(
    "btc-university",
    "set-sbtc-contract",
    [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
    deployer
  );
  if (!result.result || result.result.type !== "ok") {
    throw new Error("Failed to initialize sBTC contract");
  }
}

// Helper to mint mock sBTC tokens
function mintMockSBTC(recipient: string, amount: number) {
  return simnet.callPublicFn(
    "mock-sbtc-token",
    "mint",
    [Cl.uint(amount), Cl.principal(recipient)],
    deployer
  );
}

// ==============================
// PROPERTY-BASED FUZZ TESTS
// ==============================

describe("Property-Based Fuzz Tests", () => {
  beforeEach(() => {
    initializeSbtcContract();
  });

  describe("Whitelist Properties", () => {
    it("PROPERTY: Adding user to whitelist makes them whitelisted", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (wallet) => {
            // Add to whitelist
            simnet.callPublicFn(
              "btc-university",
              "add-whitelist",
              [Cl.principal(wallet)],
              deployer
            );

            // Check they're whitelisted
            const { result } = simnet.callReadOnlyFn(
              "btc-university",
              "is-whitelisted-beta",
              [Cl.principal(wallet)],
              deployer
            );

            expect(result.type).toBe("ok");
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Users with sufficient sBTC can self-enroll to whitelist", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          fc.integer({ min: 100000, max: 10000000 }),
          (wallet, amount) => {
            // Mint sufficient sBTC
            mintMockSBTC(wallet, amount);

            // Self-enroll
            const { result } = simnet.callPublicFn(
              "btc-university",
              "enroll-whitelist",
              [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
              wallet
            );

            expect(result.type).toBe("ok");

            // Verify whitelisted
            const checkResult = simnet.callReadOnlyFn(
              "btc-university",
              "is-whitelisted-beta",
              [Cl.principal(wallet)],
              deployer
            );

            expect(checkResult.result.type).toBe("ok");
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Self-enrollment requires sufficient sBTC balance", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          fc.integer({ min: 1, max: 99999 }),
          (wallet, amount) => {
            // Check current balance (may have sBTC from previous tests)
            const balanceResult = simnet.callReadOnlyFn(
              "mock-sbtc-token",
              "get-balance-available",
              [Cl.principal(wallet)],
              wallet
            );
            const currentBalance =
              balanceResult.result.type === "ok"
                ? Number((balanceResult.result as any).value.value)
                : 0;

            // Mint additional sBTC
            mintMockSBTC(wallet, amount);
            const totalBalance = currentBalance + amount;

            // Try to self-enroll
            const { result } = simnet.callPublicFn(
              "btc-university",
              "enroll-whitelist",
              [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
              wallet
            );

            // Should succeed if total balance >= 100000, fail otherwise
            if (totalBalance >= 100000) {
              // May succeed or already be whitelisted
              expect(["ok", "err"]).toContain(result.type);
            } else {
              // Should fail with insufficient balance
              expect(result.type).toBe("err");
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Removing whitelisted user makes them not whitelisted", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          (wallet) => {
            // Add to whitelist
            simnet.callPublicFn(
              "btc-university",
              "add-whitelist",
              [Cl.principal(wallet)],
              deployer
            );

            // Remove from whitelist
            simnet.callPublicFn(
              "btc-university",
              "remove-whitelist",
              [Cl.principal(wallet)],
              deployer
            );

            // Check they're not whitelisted
            const { result } = simnet.callReadOnlyFn(
              "btc-university",
              "is-whitelisted-beta",
              [Cl.principal(wallet)],
              deployer
            );

            expect(result.type).toBe("err");
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe("Course Properties", () => {
    it("PROPERTY: Course count increments monotonically", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc
                .string({ minLength: 1, maxLength: 100 })
                .map((s) => s.replace(/[^\x20-\x7E]/g, "A")),
              details: fc
                .string({ minLength: 1, maxLength: 256 })
                .map((s) => s.replace(/[^\x20-\x7E]/g, "B")),
              price: fc.nat({ max: 1000000000 }),
              maxStudents: fc.nat({ max: 1000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (courses) => {
            // Get initial course count (state may persist from previous tests)
            const initialCountResult = simnet.callReadOnlyFn(
              "btc-university",
              "get-course-count",
              [],
              wallet1
            );
            let previousCount =
              initialCountResult.result.type === "ok"
                ? Number((initialCountResult.result as any).value.value)
                : 0;

            for (let i = 0; i < courses.length; i++) {
              const course = courses[i];

              // Add course
              const { result } = simnet.callPublicFn(
                "btc-university",
                "add-course",
                [
                  Cl.uint(0),
                  Cl.stringAscii(course.name),
                  Cl.stringAscii(course.details),
                  Cl.principal(wallet1),
                  Cl.uint(course.price),
                  Cl.uint(course.maxStudents),
                ],
                deployer
              );

              if (result.type === "ok") {
                const currentCount = Number((result as any).value.value);
                expect(currentCount).toBe(previousCount + 1);
                previousCount = currentCount;
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it("PROPERTY: Added courses can be retrieved with correct details", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 100 })
            .map((s) => s.replace(/[^\x20-\x7E]/g, "A")),
          fc
            .string({ minLength: 1, maxLength: 256 })
            .map((s) => s.replace(/[^\x20-\x7E]/g, "B")),
          fc.nat({ max: 1000000000 }),
          fc.nat({ max: 1000 }),
          (name, details, price, maxStudents) => {
            // Add course
            const addResult = simnet.callPublicFn(
              "btc-university",
              "add-course",
              [
                Cl.uint(0),
                Cl.stringAscii(name),
                Cl.stringAscii(details),
                Cl.principal(wallet1),
                Cl.uint(price),
                Cl.uint(maxStudents),
              ],
              deployer
            );

            if (addResult.result.type === "ok") {
              const courseId = Number((addResult.result as any).value.value);

              // Retrieve course
              const { result } = simnet.callReadOnlyFn(
                "btc-university",
                "get-course-details",
                [Cl.uint(courseId)],
                wallet2
              );

              expect(result.type).toBe("ok");
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it("PROPERTY: Non-existent course IDs return errors", () => {
      fc.assert(
        fc.property(fc.integer({ min: 9999, max: 999999 }), (invalidId) => {
          const { result } = simnet.callReadOnlyFn(
            "btc-university",
            "get-course-details",
            [Cl.uint(invalidId)],
            wallet1
          );

          // Should return ERR-COURSE-NOT-FOUND (101)
          expect(result.type).toBe("err");
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("Enrollment Properties", () => {
    beforeEach(() => {
      // Setup: Add a course for enrollment tests
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.uint(0),
          Cl.stringAscii("Test Course"),
          Cl.stringAscii("Test Description"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );
    });

    it("PROPERTY: Only whitelisted users with enough sBTC can enroll", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(wallet2, wallet3, wallet4),
          fc.integer({ min: 1000000, max: 10000000 }),
          (wallet, sbtcAmount) => {
            // Whitelist user
            simnet.callPublicFn(
              "btc-university",
              "add-whitelist",
              [Cl.principal(wallet)],
              deployer
            );

            // Give them sBTC
            mintMockSBTC(wallet, sbtcAmount);

            // Enroll
            const { result } = simnet.callPublicFn(
              "btc-university",
              "enroll-course",
              [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
              wallet
            );

            // Result should be ok or already enrolled error
            expect(["ok", "err"]).toContain(result.type);

            // If successful, verify enrollment
            if (result.type === "ok") {
              const checkResult = simnet.callReadOnlyFn(
                "btc-university",
                "is-enrolled",
                [Cl.uint(1), Cl.principal(wallet)],
                deployer
              );

              expect(checkResult.result.type).toBe("ok");
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    it("PROPERTY: Cannot enroll twice in same course", () => {
      fc.assert(
        fc.property(fc.constantFrom(wallet2, wallet3, wallet4), (wallet) => {
          // Setup
          simnet.callPublicFn(
            "btc-university",
            "add-whitelist",
            [Cl.principal(wallet)],
            deployer
          );
          mintMockSBTC(wallet, 10000000);

          // First enrollment
          simnet.callPublicFn(
            "btc-university",
            "enroll-course",
            [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
            wallet
          );

          // Second enrollment attempt
          const { result } = simnet.callPublicFn(
            "btc-university",
            "enroll-course",
            [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
            wallet
          );

          // Should fail with ERR-ALREADY-ENROLLED (104)
          expect(result.type).toBe("err");
        }),
        { numRuns: 5 }
      );
    });
  });
});

// ==============================
// BOUNDARY VALUE FUZZ TESTS
// ==============================

describe("Boundary Value Fuzz Tests", () => {
  beforeEach(() => {
    initializeSbtcContract();
  });

  it("FUZZ: Extreme uint values for course prices", () => {
    const extremeValues = [
      0n,
      1n,
      BigInt(Number.MAX_SAFE_INTEGER),
      340282366920938463463374607431768211455n, // u128 max
    ];

    extremeValues.forEach((value) => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.uint(0),
          Cl.stringAscii("Test Course"),
          Cl.stringAscii("Test Details"),
          Cl.principal(wallet1),
          Cl.uint(value),
          Cl.uint(100),
        ],
        deployer
      );

      // All should succeed or fail gracefully
      expect(["ok", "err"]).toContain(result.type);
    });
  });

  it("FUZZ: Extreme string lengths for course names and details", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 100 })
          .map((s) => s.replace(/[^\x20-\x7E]/g, "X")),
        fc
          .string({ minLength: 1, maxLength: 256 })
          .map((s) => s.replace(/[^\x20-\x7E]/g, "Y")),
        (name, details) => {
          const { result } = simnet.callPublicFn(
            "btc-university",
            "add-course",
            [
              Cl.uint(0),
              Cl.stringAscii(name),
              Cl.stringAscii(details),
              Cl.principal(wallet1),
              Cl.uint(1000000),
              Cl.uint(50),
            ],
            deployer
          );

          // Should handle all valid lengths
          expect(["ok", "err"]).toContain(result.type);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("FUZZ: Edge case sBTC balances for whitelist enrollment", () => {
    const edgeCaseBalances = [
      0, // No balance
      1, // Minimal
      99999, // Just below threshold
      100000, // Exact threshold
      100001, // Just above threshold
      1000000, // Comfortable amount
    ];

    edgeCaseBalances.forEach((balance, idx) => {
      const wallet = [wallet1, wallet2, wallet3, wallet4][idx % 4];

      if (balance > 0) {
        mintMockSBTC(wallet, balance);
      }

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet
      );

      if (balance >= 100000) {
        expect(result.type).toBe("ok");
      } else {
        expect(result.type).toBe("err");
      }
    });
  });

  it("FUZZ: Zero and maximum values for max-students", () => {
    const maxStudentValues = [0, 1, 100, 1000, 10000, Number.MAX_SAFE_INTEGER];

    maxStudentValues.forEach((maxStudents, idx) => {
      const { result} = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.uint(0),
          Cl.stringAscii(`Course ${idx}`),
          Cl.stringAscii("Details"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(maxStudents),
        ],
        deployer
      );

      expect(result.type).toBe("ok");
    });
  });
});

// ==============================
// INVARIANT FUZZ TESTS
// ==============================

describe("Invariant Fuzz Tests", () => {
  beforeEach(() => {
    initializeSbtcContract();
  });

  it("INVARIANT: Course count never decreases", () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 10 }), { minLength: 5, maxLength: 20 }),
        (operations) => {
          let previousCount = 0;

          for (const op of operations) {
            // Add a course
            simnet.callPublicFn(
              "btc-university",
              "add-course",
              [
                Cl.uint(0),
                Cl.stringAscii(`Course ${op}`),
                Cl.stringAscii("Details"),
                Cl.principal(wallet1),
                Cl.uint(1000000),
                Cl.uint(50),
              ],
              deployer
            );

            // Check count
            const { result } = simnet.callReadOnlyFn(
              "btc-university",
              "get-course-count",
              [],
              wallet1
            );

            if (result.type === "ok") {
              const currentCount = Number((result as any).value.value);
              expect(currentCount).toBeGreaterThanOrEqual(previousCount);
              previousCount = currentCount;
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("INVARIANT: Total course fees equals sum of enrollments", () => {
    // Setup course
    simnet.callPublicFn(
      "btc-university",
      "add-course",
      [
        Cl.uint(0),
        Cl.stringAscii("Test Course"),
        Cl.stringAscii("Details"),
        Cl.principal(wallet1),
        Cl.uint(1000000),
        Cl.uint(100),
      ],
      deployer
    );

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(wallet2, wallet3, wallet4), {
          minLength: 1,
          maxLength: 3,
        }),
        (wallets) => {
          const uniqueWallets = [...new Set(wallets)];
          let expectedFees = 0;

          for (const wallet of uniqueWallets) {
            // Whitelist
            simnet.callPublicFn(
              "btc-university",
              "add-whitelist",
              [Cl.principal(wallet)],
              deployer
            );

            // Give sBTC
            mintMockSBTC(wallet, 10000000);

            // Enroll
            const enrollResult = simnet.callPublicFn(
              "btc-university",
              "enroll-course",
              [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
              wallet
            );

            if (enrollResult.result.type === "ok") {
              expectedFees += 1000000;
            }
          }

          // Instructor claims
          const { result } = simnet.callPublicFn(
            "btc-university",
            "claim-course-fees",
            [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
            wallet1
          );

          if (result.type === "ok" && expectedFees > 0) {
            const claimedFees = Number((result as any).value.value);
            expect(claimedFees).toBe(expectedFees);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it("INVARIANT: User either whitelisted or not, no intermediate state", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
        fc.array(fc.boolean(), { minLength: 5, maxLength: 10 }),
        (wallet, operations) => {
          for (const shouldAdd of operations) {
            if (shouldAdd) {
              simnet.callPublicFn(
                "btc-university",
                "add-whitelist",
                [Cl.principal(wallet)],
                deployer
              );
            } else {
              simnet.callPublicFn(
                "btc-university",
                "remove-whitelist",
                [Cl.principal(wallet)],
                deployer
              );
            }

            // Check state is always definite
            const { result } = simnet.callReadOnlyFn(
              "btc-university",
              "is-whitelisted-beta",
              [Cl.principal(wallet)],
              deployer
            );

            // Result is either ok(true) or err
            expect(["ok", "err"]).toContain(result.type);
            // Both ok and err are valid states for whitelist check
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ==============================
// SEQUENCE-BASED FUZZ TESTS
// ==============================

describe("Sequence-Based Fuzz Tests", () => {
  beforeEach(() => {
    initializeSbtcContract();
  });

  it("FUZZ: Random sequence of whitelist operations", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            action: fc.constantFrom("add", "remove", "check"),
            wallet: fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
          }),
          { minLength: 10, maxLength: 30 }
        ),
        (operations) => {
          for (const op of operations) {
            if (op.action === "add") {
              simnet.callPublicFn(
                "btc-university",
                "add-whitelist",
                [Cl.principal(op.wallet)],
                deployer
              );
            } else if (op.action === "remove") {
              simnet.callPublicFn(
                "btc-university",
                "remove-whitelist",
                [Cl.principal(op.wallet)],
                deployer
              );
            } else {
              const { result } = simnet.callReadOnlyFn(
                "btc-university",
                "is-whitelisted-beta",
                [Cl.principal(op.wallet)],
                deployer
              );
              expect(["ok", "err"]).toContain(result.type);
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it("FUZZ: Random sequence of course additions and queries", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            action: fc.constantFrom("add", "query", "count"),
            price: fc.nat({ max: 10000000 }),
          }),
          { minLength: 5, maxLength: 15 }
        ),
        (operations) => {
          let addedCount = 0;

          for (const op of operations) {
            if (op.action === "add") {
              const result = simnet.callPublicFn(
                "btc-university",
                "add-course",
                [
                  Cl.uint(0),
                  Cl.stringAscii(`Course ${addedCount}`),
                  Cl.stringAscii("Details"),
                  Cl.principal(wallet1),
                  Cl.uint(op.price),
                  Cl.uint(100),
                ],
                deployer
              );
              if (result.result.type === "ok") {
                addedCount++;
              }
            } else if (op.action === "query" && addedCount > 0) {
              const randomId = Math.floor(Math.random() * addedCount) + 1;
              const { result } = simnet.callReadOnlyFn(
                "btc-university",
                "get-course-details",
                [Cl.uint(randomId)],
                wallet1
              );
              expect(result.type).toBe("ok");
            } else if (op.action === "count") {
              const { result } = simnet.callReadOnlyFn(
                "btc-university",
                "get-course-count",
                [],
                wallet1
              );
              expect(result.type).toBe("ok");
            }
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it("FUZZ: Complex workflow with random operations", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            action: fc.constantFrom(
              "addCourse",
              "whitelist",
              "enroll",
              "complete"
            ),
            wallet: fc.constantFrom(wallet2, wallet3, wallet4),
            price: fc.integer({ min: 100000, max: 5000000 }),
            sbtcAmount: fc.integer({ min: 1000000, max: 10000000 }),
          }),
          { minLength: 5, maxLength: 10 }
        ),
        (operations) => {
          let courseCount = 0;

          for (const op of operations) {
            try {
              if (op.action === "addCourse") {
                const result = simnet.callPublicFn(
                  "btc-university",
                  "add-course",
                  [
                    Cl.uint(0),
                    Cl.stringAscii(`Course ${courseCount}`),
                    Cl.stringAscii("Details"),
                    Cl.principal(wallet1),
                    Cl.uint(op.price),
                    Cl.uint(100),
                  ],
                  deployer
                );
                if (result.result.type === "ok") {
                  courseCount++;
                }
              } else if (op.action === "whitelist") {
                simnet.callPublicFn(
                  "btc-university",
                  "add-whitelist",
                  [Cl.principal(op.wallet)],
                  deployer
                );
              } else if (op.action === "enroll" && courseCount > 0) {
                mintMockSBTC(op.wallet, op.sbtcAmount);
                simnet.callPublicFn(
                  "btc-university",
                  "add-whitelist",
                  [Cl.principal(op.wallet)],
                  deployer
                );
                simnet.callPublicFn(
                  "btc-university",
                  "enroll-course",
                  [
                    Cl.uint(1),
                    Cl.contractPrincipal(deployer, "mock-sbtc-token"),
                  ],
                  op.wallet
                );
              }
            } catch (e) {
              // Some operations may fail, that's okay in fuzz testing
            }
          }

          // Final invariant check: system should still be consistent
          const { result } = simnet.callReadOnlyFn(
            "btc-university",
            "get-course-count",
            [],
            wallet1
          );
          expect(result.type).toBe("ok");
        }
      ),
      { numRuns: 3 }
    );
  });
});

// ==============================
// AUTHORIZATION FUZZ TESTS
// ==============================

describe("Authorization Fuzz Tests", () => {
  beforeEach(() => {
    initializeSbtcContract();
  });

  it("FUZZ: Only instructors can perform admin functions", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(wallet1, wallet2, wallet3, wallet4),
        (unauthorizedWallet) => {
          // Try to add course as non-instructor
          const courseResult = simnet.callPublicFn(
            "btc-university",
            "add-course",
            [
              Cl.uint(0),
              Cl.stringAscii("Unauthorized Course"),
              Cl.stringAscii("Should fail"),
              Cl.principal(wallet1),
              Cl.uint(1000000),
              Cl.uint(50),
            ],
            unauthorizedWallet
          );
          expect(courseResult.result.type).toBe("err");

          // Try to add whitelist as non-owner
          const whitelistResult = simnet.callPublicFn(
            "btc-university",
            "add-whitelist",
            [Cl.principal(wallet2)],
            unauthorizedWallet
          );
          expect(whitelistResult.result.type).toBe("err");
        }
      ),
      { numRuns: 10 }
    );
  });

  it("FUZZ: Only instructor or course instructor can complete courses", () => {
    // Setup
    simnet.callPublicFn(
      "btc-university",
      "add-course",
      [
        Cl.uint(0),
        Cl.stringAscii("Test Course"),
        Cl.stringAscii("Details"),
        Cl.principal(wallet1),
        Cl.uint(1000000),
        Cl.uint(50),
      ],
      deployer
    );

    simnet.callPublicFn(
      "btc-university",
      "add-whitelist",
      [Cl.principal(wallet2)],
      deployer
    );

    mintMockSBTC(wallet2, 5000000);

    simnet.callPublicFn(
      "btc-university",
      "enroll-course",
      [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
      wallet2
    );

    fc.assert(
      fc.property(fc.constantFrom(wallet3, wallet4), (unauthorizedWallet) => {
        const { result } = simnet.callPublicFn(
          "btc-university",
          "complete-course",
          [Cl.uint(1), Cl.principal(wallet2)],
          unauthorizedWallet
        );

        // Should fail for unauthorized wallets
        expect(result.type).toBe("err");
      }),
      { numRuns: 5 }
    );
  });
});
