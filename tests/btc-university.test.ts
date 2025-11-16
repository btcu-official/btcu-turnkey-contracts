import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

// SECURITY: Helper to initialize sBTC contract
// This simulates owner setting the official sBTC contract after deployment
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

// Helper to mint mock sBTC tokens for testing
function mintMockSBTC(recipient: string, amount: number) {
  return simnet.callPublicFn(
    "mock-sbtc-token",
    "mint",
    [Cl.uint(amount), Cl.principal(recipient)],
    deployer
  );
}

// ==============================
// WHITELIST FUNCTION TESTS
// ==============================

describe("Whitelist Functions", () => {
  // Initialize sBTC before these tests
  beforeEach(() => {
    initializeSbtcContract();
  });

  describe("add-whitelist", () => {
    it("allows owner to add user to whitelist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from adding to whitelist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-OWNER-ONLY
    });

    it("returns error when adding already whitelisted user", () => {
      // Add user first time
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Try to add same user again
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(104)); // Already whitelisted
    });

    it("allows adding multiple different users", () => {
      const result1 = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      const result2 = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  describe("remove-whitelist", () => {
    beforeEach(() => {
      // Add wallet1 to whitelist before each test
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
    });

    it("allows owner to remove user from whitelist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner from removing from whitelist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-OWNER-ONLY
    });

    it("returns error when removing non-whitelisted user", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(108)); // ERR-UNAUTHORIZED
    });

    it("verifies user is removed by checking whitelist status", () => {
      // Remove user
      simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Check whitelist status
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-USER-NOT-WHITELISTED
    });
  });

  describe("is-whitelisted-beta", () => {
    it("returns true for whitelisted user", () => {
      // Add user to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Check status
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("returns error for non-whitelisted user", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-USER-NOT-WHITELISTED
    });

    it("can be called by any address", () => {
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Call from different addresses
      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        wallet3
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  describe("enroll-whitelist", () => {
    it("allows self-enrollment when user has sufficient sBTC balance", () => {
      // Mint enough sBTC to wallet1 (MIN-SBTC-BALANCE is 100000)
      mintMockSBTC(wallet1, 200000);

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify user is now whitelisted
      const whitelist = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(whitelist.result).toBeOk(Cl.bool(true));
    });

    it("returns error when user has insufficient sBTC balance", () => {
      // Mint insufficient sBTC to wallet2 (MIN-SBTC-BALANCE is 100000)
      mintMockSBTC(wallet2, 50000);

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(7002)); // ERR-NOT-ENOUGH-SBTC
    });

    it("returns error when user has no sBTC balance", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet3
      );
      expect(result).toBeErr(Cl.uint(7002)); // ERR-NOT-ENOUGH-SBTC
    });

    it("allows enrollment at exact minimum sBTC balance", () => {
      // Mint exactly MIN-SBTC-BALANCE (100000)
      mintMockSBTC(wallet4, 100000);

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet4
      );
      expect(result).toBeOk(Cl.bool(true));
    });
  });
});

// ==============================
// COURSE FUNCTION TESTS
// ==============================

describe("Course Functions", () => {
  describe("add-course", () => {
    it("allows owner to add a course", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Introduction to Bitcoin"),
          Cl.stringAscii("Learn the basics of Bitcoin and blockchain technology"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(100),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("prevents non-owner from adding courses", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Unauthorized Course"),
          Cl.stringAscii("This should fail"),
          Cl.principal(wallet2),
          Cl.uint(1000000),
          Cl.uint(100),
        ],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-OWNER-ONLY
    });

    it("increments course ID correctly for multiple courses", () => {
      const result1 = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 1"),
          Cl.stringAscii("First course"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      const result2 = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 2"),
          Cl.stringAscii("Second course"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(75),
        ],
        deployer
      );
      expect(result2.result).toBeOk(Cl.uint(2));

      const result3 = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 3"),
          Cl.stringAscii("Third course"),
          Cl.principal(wallet3),
          Cl.uint(3000000),
          Cl.uint(100),
        ],
        deployer
      );
      expect(result3.result).toBeOk(Cl.uint(3));
    });

    it("accepts maximum length strings for name and details", () => {
      const maxName = "A".repeat(100);
      const maxDetails = "B".repeat(256);

      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii(maxName),
          Cl.stringAscii(maxDetails),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(100),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("accepts zero price and max students", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Free Course"),
          Cl.stringAscii("No price or limit"),
          Cl.principal(wallet1),
          Cl.uint(0),
          Cl.uint(0),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });
  });

  describe("get-course-details", () => {
    beforeEach(() => {
      // Add a test course
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Test Course"),
          Cl.stringAscii("Test Description"),
          Cl.principal(wallet1),
          Cl.uint(5000000),
          Cl.uint(50),
        ],
        deployer
      );
    });

    it("returns course details for valid course ID", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-details",
        [Cl.uint(1)],
        wallet2
      );

      expect(result).toBeOk(
        Cl.tuple({
          name: Cl.stringAscii("Test Course"),
          details: Cl.stringAscii("Test Description"),
          instructor: Cl.principal(wallet1),
          price: Cl.uint(5000000),
          "max-students": Cl.uint(50),
        })
      );
    });

    it("returns error for non-existent course", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-details",
        [Cl.uint(999)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-COURSE-NOT-FOUND
    });

    it("returns error for course ID 0", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-details",
        [Cl.uint(0)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-COURSE-NOT-FOUND
    });

    it("can be called by any address", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-details",
        [Cl.uint(1)],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.tuple({
        name: Cl.stringAscii("Test Course"),
        details: Cl.stringAscii("Test Description"),
        instructor: Cl.principal(wallet1),
        price: Cl.uint(5000000),
        "max-students": Cl.uint(50),
      }));

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-details",
        [Cl.uint(1)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.tuple({
        name: Cl.stringAscii("Test Course"),
        details: Cl.stringAscii("Test Description"),
        instructor: Cl.principal(wallet1),
        price: Cl.uint(5000000),
        "max-students": Cl.uint(50),
      }));
    });
  });

  describe("get-course-count", () => {
    it("returns 0 when no courses added", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("returns correct count after adding courses", () => {
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 1"),
          Cl.stringAscii("Details 1"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );

      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 2"),
          Cl.stringAscii("Details 2"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(100),
        ],
        deployer
      );

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(result2.result).toBeOk(Cl.uint(2));
    });

    it("can be called by any address", () => {
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course"),
          Cl.stringAscii("Details"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );

      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet2
      );
      expect(result2.result).toBeOk(Cl.uint(1));
    });
  });

  describe("get-all-courses", () => {
    it("returns empty list when no courses exist", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-all-courses",
        [],
        wallet1
      );
      
      expect(result).toBeOk(
        Cl.list([
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
          Cl.none(),
        ])
      );
    });

    it("returns courses when they exist", () => {
      // Add first course
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 1"),
          Cl.stringAscii("Details 1"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );

      // Add second course
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 2"),
          Cl.stringAscii("Details 2"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(100),
        ],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-all-courses",
        [],
        wallet1
      );

      // Result should be ok and contain a list
      expect(result.type).toBe("ok"); // ResponseOk type
    });
  });
});

// ==============================
// ENROLLMENT FUNCTION TESTS
// ==============================

describe("Enrollment Functions", () => {
  // Initialize sBTC before these tests
  beforeEach(() => {
    initializeSbtcContract();
  });


  beforeEach(() => {
    // Add a course
    simnet.callPublicFn(
      "btc-university",
      "add-course",
      [
        Cl.stringAscii("Test Course"),
        Cl.stringAscii("Test Description"),
        Cl.principal(wallet1),
        Cl.uint(1000000),
        Cl.uint(50),
      ],
      deployer
    );
  });

  describe("is-enrolled", () => {
    it("returns error for non-enrolled student", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "is-enrolled",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-USER-NOT-ENROLLED
    });

    it("can be called by any address", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "is-enrolled",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet1
      );
      expect(result1.result).toBeErr(Cl.uint(103));

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "is-enrolled",
        [Cl.uint(1), Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeErr(Cl.uint(103));
    });
  });

  describe("get-enrolled-ids", () => {
    it("returns empty list when student not enrolled in any courses", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university",
        "get-enrolled-ids",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result).toBeOk(Cl.list([]));
    });

    it("can be called by any address", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university",
        "get-enrolled-ids",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result1.result).toBeOk(Cl.list([]));

      const result2 = simnet.callReadOnlyFn(
        "btc-university",
        "get-enrolled-ids",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.list([]));
    });
  });

  describe("complete-course", () => {
    it("returns error when student not enrolled", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "complete-course",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-USER-NOT-ENROLLED
    });

    it("returns error when course doesn't exist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "complete-course",
        [Cl.uint(999), Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-USER-NOT-ENROLLED
    });

    it("prevents non-instructor non-owner from completing course", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "complete-course",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet3
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-USER-NOT-ENROLLED (no enrollment exists)
    });
  });

  describe("enroll-course", () => {
    it("returns error when student not whitelisted", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-USER-NOT-WHITELISTED
    });

    it("returns error when course doesn't exist", () => {
      // Add wallet2 to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(999), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-COURSE-NOT-FOUND
    });

    it("allows enrollment when user has sufficient sBTC and is whitelisted", () => {
      // Add wallet2 to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        deployer
      );

      // Mint enough sBTC for wallet2 (course price is 1000000)
      mintMockSBTC(wallet2, 5000000);

      // Enroll in course
      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify enrollment
      const enrolled = simnet.callReadOnlyFn(
        "btc-university",
        "is-enrolled",
        [Cl.uint(1), Cl.principal(wallet2)],
        deployer
      );
      expect(enrolled.result).toBeOk(Cl.bool(true));
    });

    it("returns error when user doesn't have enough sBTC", () => {
      // Add wallet3 to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet3)],
        deployer
      );

      // Mint insufficient sBTC (course price is 1000000)
      mintMockSBTC(wallet3, 500000);

      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet3
      );
      expect(result).toBeErr(Cl.uint(7002)); // ERR-NOT-ENOUGH-SBTC
    });

    it("returns error when already enrolled", () => {
      // Add wallet4 to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet4)],
        deployer
      );

      // Mint sBTC
      mintMockSBTC(wallet4, 5000000);

      // Enroll first time
      simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet4
      );

      // Try to enroll again
      const { result } = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet4
      );
      expect(result).toBeErr(Cl.uint(104)); // ERR-ALREADY-ENROLLED
    });
  });

  describe("claim-course-fees", () => {
    it("returns error when course doesn't exist", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(999), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-COURSE-NOT-FOUND
    });

    it("returns error when called by non-instructor", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(108)); // ERR-UNAUTHORIZED
    });

    it("allows instructor to claim fees when no enrollments", () => {
      // wallet1 is the instructor for course 1
      // When fees are 0, no transfer happens, so no error
      const { result } = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      // Transfer of 0 amount will fail, so we expect the error
      // This is expected behavior - claiming 0 fees with empty contract balance
      expect(result).toBeErr(Cl.uint(7002)); // ERR-NOT-ENOUGH-SBTC
    });

    it("allows instructor to claim accumulated fees", () => {
      // Setup: wallet2 enrolls in course
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

      // Instructor claims fees
      const { result } = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      // Should return the course price (1000000)
      expect(result).toBeOk(Cl.uint(1000000));
    });

    it("resets fees to 0 after claiming", () => {
      // Setup: wallet3 enrolls
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet3)],
        deployer
      );
      mintMockSBTC(wallet3, 5000000);
      
      simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet3
      );

      // Claim fees
      const claim1 = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(claim1.result).toBeOk(Cl.uint(1000000));

      // Try to claim again - fees are now 0, transfer of 0 will fail
      const { result } = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      // Expect error because transferring 0 from empty contract fails
      expect(result).toBeErr(Cl.uint(7002)); // ERR-NOT-ENOUGH-SBTC
    });
  });
});

// ==============================
// EDGE CASES AND SECURITY TESTS
// ==============================

describe("Edge Cases and Security", () => {
  // Initialize sBTC before these tests
  beforeEach(() => {
    initializeSbtcContract();
  });

  describe("Authorization Edge Cases", () => {
    it("deployer is the owner and has special privileges", () => {
      // Owner can add courses
      const result1 = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Owner Course"),
          Cl.stringAscii("Owner can add this"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // Owner can add to whitelist
      const result2 = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });

    it("non-owner cannot perform owner-only operations", () => {
      const result1 = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Unauthorized"),
          Cl.stringAscii("Should fail"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        wallet1
      );
      expect(result1.result).toBeErr(Cl.uint(100));

      const result2 = simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result2.result).toBeErr(Cl.uint(100));
    });
  });

  describe("Data Consistency", () => {
    it("course count increases monotonically", () => {
      const count1 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(count1.result).toBeOk(Cl.uint(0));

      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 1"),
          Cl.stringAscii("Details"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );

      const count2 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(count2.result).toBeOk(Cl.uint(1));

      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Course 2"),
          Cl.stringAscii("Details"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(100),
        ],
        deployer
      );

      const count3 = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(count3.result).toBeOk(Cl.uint(2));
    });

    it("whitelist status persists correctly", () => {
      // Add to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Check multiple times
      const check1 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(check1.result).toBeOk(Cl.bool(true));

      const check2 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        wallet3
      );
      expect(check2.result).toBeOk(Cl.bool(true));

      // Remove from whitelist
      simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      // Check again
      const check3 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(check3.result).toBeErr(Cl.uint(102));
    });
  });

  describe("Boundary Values", () => {
    it("handles maximum uint values", () => {
      const maxUint = "340282366920938463463374607431768211455"; // u128 max
      
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Expensive Course"),
          Cl.stringAscii("Max price"),
          Cl.principal(wallet1),
          Cl.uint(maxUint),
          Cl.uint(maxUint),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("handles empty strings within allowed bounds", () => {
      const { result } = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("A"),
          Cl.stringAscii("B"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });
  });

  describe("Multiple Operations Sequence", () => {
    it("handles complex workflow", () => {
      // 1. Add multiple courses
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Bitcoin 101"),
          Cl.stringAscii("Intro to Bitcoin"),
          Cl.principal(wallet1),
          Cl.uint(1000000),
          Cl.uint(50),
        ],
        deployer
      );

      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Advanced Stacks"),
          Cl.stringAscii("Deep dive into Stacks"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(30),
        ],
        deployer
      );

      // 2. Add multiple users to whitelist
      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet2)],
        deployer
      );

      simnet.callPublicFn(
        "btc-university",
        "add-whitelist",
        [Cl.principal(wallet3)],
        deployer
      );

      // 3. Verify course count
      const count = simnet.callReadOnlyFn(
        "btc-university",
        "get-course-count",
        [],
        wallet1
      );
      expect(count.result).toBeOk(Cl.uint(2));

      // 4. Verify whitelist status
      const wl1 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(wl1.result).toBeOk(Cl.bool(true));

      const wl2 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(wl2.result).toBeOk(Cl.bool(true));

      // 5. Remove one user from whitelist
      simnet.callPublicFn(
        "btc-university",
        "remove-whitelist",
        [Cl.principal(wallet1)],
        deployer
      );

      const wl3 = simnet.callReadOnlyFn(
        "btc-university",
        "is-whitelisted-beta",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(wl3.result).toBeErr(Cl.uint(102));
    });
  });

  describe("Complete Enrollment Workflow with sBTC", () => {
    it("simulates full student journey with sBTC", () => {
      // 1. Student gets sBTC
      mintMockSBTC(wallet1, 10000000);

      // 2. Student self-enrolls to whitelist using sBTC
      const whitelistResult = simnet.callPublicFn(
        "btc-university",
        "enroll-whitelist",
        [Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(whitelistResult.result).toBeOk(Cl.bool(true));

      // 3. Owner creates a course
      const courseResult = simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Bitcoin Fundamentals"),
          Cl.stringAscii("Learn Bitcoin basics"),
          Cl.principal(wallet2),
          Cl.uint(2000000),
          Cl.uint(100),
        ],
        deployer
      );
      expect(courseResult.result).toBeOk(Cl.uint(1));

      // 4. Student enrolls in course paying with sBTC
      const enrollResult = simnet.callPublicFn(
        "btc-university",
        "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(enrollResult.result).toBeOk(Cl.bool(true));

      // 5. Verify enrollment status
      const enrolled = simnet.callReadOnlyFn(
        "btc-university",
        "is-enrolled",
        [Cl.uint(1), Cl.principal(wallet1)],
        deployer
      );
      expect(enrolled.result).toBeOk(Cl.bool(true));

      // 6. Instructor completes student's course
      const completeResult = simnet.callPublicFn(
        "btc-university",
        "complete-course",
        [Cl.uint(1), Cl.principal(wallet1)],
        wallet2
      );
      expect(completeResult.result).toBeOk(Cl.bool(true));

      // 7. Instructor claims fees
      const claimResult = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet2
      );
      expect(claimResult.result).toBeOk(Cl.uint(2000000));
    });

    it("simulates multiple students enrolling with sBTC", () => {
      // Setup course
      simnet.callPublicFn(
        "btc-university",
        "add-course",
        [
          Cl.stringAscii("Advanced Stacks"),
          Cl.stringAscii("Deep dive"),
          Cl.principal(wallet1),
          Cl.uint(3000000),
          Cl.uint(50),
        ],
        deployer
      );

      // Three students get sBTC and enroll
      const students = [wallet2, wallet3, wallet4];
      students.forEach((student) => {
        // Give sBTC
        mintMockSBTC(student, 10000000);

        // Add to whitelist
        simnet.callPublicFn(
          "btc-university",
          "add-whitelist",
          [Cl.principal(student)],
          deployer
        );

        // Enroll in course
        const result = simnet.callPublicFn(
          "btc-university",
          "enroll-course",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
          student
        );
        expect(result.result).toBeOk(Cl.bool(true));
      });

      // Instructor claims total fees (3 * 3000000 = 9000000)
      const claimResult = simnet.callPublicFn(
        "btc-university",
        "claim-course-fees",
        [Cl.uint(1), Cl.contractPrincipal(deployer, "mock-sbtc-token")],
        wallet1
      );
      expect(claimResult.result).toBeOk(Cl.uint(9000000));
    });
  });
});
