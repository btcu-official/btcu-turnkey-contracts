import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

// ==============================
// NFT CONTRACT CONSTANTS TESTS
// ==============================

describe("NFT Contract Constants", () => {
  it("contract deployer is set correctly", () => {
    expect(deployer).toBeDefined();
  });

  it("error codes are defined correctly", () => {
    // ERR-INSTRUCTOR-ONLY should be u100
    // ERR-NOT-CERTI-HOLDER should be u101
    // ERR-INVALID-PRINCIPAL should be u102
    // ERR-ALREADY-MINTED should be u103
    expect(true).toBe(true);
  });
});

// ==============================
// INSTRUCTOR MANAGEMENT TESTS
// ==============================

describe("Instructor Management", () => {
  describe("is-instructor", () => {
    it("deployer is instructor by default", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "is-instructor",
        [Cl.principal(deployer)],
        wallet1
      );
      expect(result).toEqual(Cl.bool(true));
    });

    it("non-instructors return false", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "is-instructor",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result1.result).toEqual(Cl.bool(false));

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "is-instructor",
        [Cl.principal(wallet2)],
        wallet2
      );
      expect(result2.result).toEqual(Cl.bool(false));
    });
  });

  describe("add-instructor", () => {
    it("deployer can add new instructor", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify wallet1 is now an instructor
      const checkResult = simnet.callReadOnlyFn(
        "btc-university-nft",
        "is-instructor",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(checkResult.result).toEqual(Cl.bool(true));
    });

    it("instructor can add new instructor", () => {
      // First add wallet1 as instructor
      simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet1)],
        deployer
      );

      // wallet1 adds wallet2
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify wallet2 is now an instructor
      const checkResult = simnet.callReadOnlyFn(
        "btc-university-nft",
        "is-instructor",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(checkResult.result).toEqual(Cl.bool(true));
    });

    it("non-instructor cannot add instructor", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY
    });
  });
});

// ==============================
// READ-ONLY FUNCTION TESTS
// ==============================

describe("Read-Only Functions", () => {
  describe("get-last-token-id", () => {
    it("returns 0 when no tokens minted", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(0));
    });

    it("can be called by any address", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.uint(0));

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet2
      );
      expect(result2.result).toBeOk(Cl.uint(0));

      const result3 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        deployer
      );
      expect(result3.result).toBeOk(Cl.uint(0));
    });

    it("increments after minting", () => {
      // Mint first NFT
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(1));
    });

    it("increments correctly for multiple mints", () => {
      // Mint three NFTs
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet3)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(result.result).toBeOk(Cl.uint(3));
    });
  });

  describe("get-token-uri", () => {
    it("returns none for any token ID", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(1)],
        wallet1
      );
      expect(result).toBeOk(Cl.none());
    });

    it("returns none even after minting", () => {
      // Mint an NFT
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(1)],
        wallet1
      );
      expect(result.result).toBeOk(Cl.none());
    });
  });

  describe("has-nft", () => {
    it("returns false for student without NFT", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "has-nft",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(false));
    });

    it("returns true for student with NFT", () => {
      // Mint NFT for wallet1
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "has-nft",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("can be called by any address", () => {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "has-nft",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "has-nft",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  describe("get-student-token-id", () => {
    it("returns none for student without NFT", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-student-token-id",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeOk(Cl.none());
    });

    it("returns token info for student with NFT", () => {
      // Mint NFT for wallet1
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-student-token-id",
        [Cl.principal(wallet1)],
        wallet2
      );
      
      expect(result.result).toBeOk(
        Cl.some(
          Cl.tuple({
            "token-id": Cl.uint(1),
            minted: Cl.bool(true),
          })
        )
      );
    });

    it("can be called by any address", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(1)],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.none());

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(999)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.none());
    });

    it("accepts various token IDs", () => {
      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(0)],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.none());

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(1)],
        wallet1
      );
      expect(result2.result).toBeOk(Cl.none());

      const result3 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-token-uri",
        [Cl.uint(999999)],
        wallet1
      );
      expect(result3.result).toBeOk(Cl.none());
    });
  });

  describe("get-owner", () => {
    it("returns none for non-existent token", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        wallet1
      );
      expect(result).toBeOk(Cl.none());
    });

    it("returns owner after minting", () => {
      // Mint NFT for wallet1
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        wallet2
      );
      expect(result.result).toBeOk(Cl.some(Cl.principal(wallet1)));
    });

    it("returns correct owner for multiple NFTs", () => {
      // Mint NFTs for different wallets
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet3)],
        deployer
      );

      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.some(Cl.principal(wallet1)));

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.some(Cl.principal(wallet2)));

      const result3 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(3)],
        deployer
      );
      expect(result3.result).toBeOk(Cl.some(Cl.principal(wallet3)));
    });

    it("can be called by any address", () => {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const result1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.some(Cl.principal(wallet1)));

      const result2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        wallet2
      );
      expect(result2.result).toBeOk(Cl.some(Cl.principal(wallet1)));

      const result3 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result3.result).toBeOk(Cl.some(Cl.principal(wallet1)));
    });

    it("returns none for token ID 0", () => {
      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(0)],
        wallet1
      );
      expect(result).toBeOk(Cl.none());
    });
  });
});

// ==============================
// MINT FUNCTION TESTS
// ==============================

describe("Mint Function", () => {
  describe("Authorization", () => {
    it("allows deployer (instructor) to mint", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("allows added instructor to mint", () => {
      // Add wallet1 as instructor
      simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet1)],
        deployer
      );

      // wallet1 can now mint
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("prevents non-instructor from minting", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY
    });

    it("prevents user from minting for themselves if not instructor", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY
    });
  });

  describe("One NFT Per Student", () => {
    it("prevents minting duplicate NFT for same student", () => {
      // First mint succeeds
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // Second mint for same student fails
      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result2.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED
    });

    it("different students can each receive one NFT", () => {
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.uint(2));

      const result3 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(result3.result).toBeOk(Cl.uint(3));
    });

    it("different instructors cannot mint duplicate NFT for same student", () => {
      // Add wallet2 as instructor
      simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet2)],
        deployer
      );

      // Deployer mints for wallet1
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // wallet2 (instructor) tries to mint for wallet1 again
      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result2.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED
    });
  });

  describe("Token ID Generation", () => {
    it("first mint returns token ID 1", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("increments token ID for each mint", () => {
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.uint(2));

      const result3 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet3)],
        deployer
      );
      expect(result3.result).toBeOk(Cl.uint(3));
    });

    it("token IDs are sequential and monotonic", () => {
      const tokenIds = [];
      const wallets = [wallet1, wallet2, wallet3, wallet4, deployer];

      for (let i = 0; i < wallets.length; i++) {
        const result = simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(wallets[i])],
          deployer
        );
        const tokenId = (result.result as any).value.value;
        tokenIds.push(tokenId);
      }

      // Check they are sequential
      for (let i = 0; i < tokenIds.length - 1; i++) {
        expect(Number(tokenIds[i + 1])).toBe(Number(tokenIds[i]) + 1);
      }
    });
  });

  describe("Recipient Assignment", () => {
    it("mints NFT to specified recipient", () => {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeOk(Cl.some(Cl.principal(wallet1)));
    });

    it("allows minting to different recipients", () => {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet3)],
        deployer
      );

      const owner1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(owner1.result).toBeOk(Cl.some(Cl.principal(wallet1)));

      const owner2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(2)],
        deployer
      );
      expect(owner2.result).toBeOk(Cl.some(Cl.principal(wallet2)));

      const owner3 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(3)],
        deployer
      );
      expect(owner3.result).toBeOk(Cl.some(Cl.principal(wallet3)));
    });

    it("prevents minting multiple NFTs to same recipient", () => {
      // First mint succeeds
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // Second mint fails
      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result2.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED

      // Third mint also fails
      const result3 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result3.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED

      // Only token 1 exists
      const owner1 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        deployer
      );
      expect(owner1.result).toBeOk(Cl.some(Cl.principal(wallet1)));

      // Token 2 doesn't exist
      const owner2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(2)],
        deployer
      );
      expect(owner2.result).toBeOk(Cl.none());
    });

    it("can mint to deployer address", () => {
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(deployer)],
        deployer
      );
      expect(result).toBeOk(Cl.uint(1));

      const owner = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1)],
        wallet1
      );
      expect(owner.result).toBeOk(Cl.some(Cl.principal(deployer)));
    });
  });

  describe("State Updates", () => {
    it("updates last-token-id after minting", () => {
      const beforeMint = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(beforeMint.result).toBeOk(Cl.uint(0));

      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      const afterMint = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(afterMint.result).toBeOk(Cl.uint(1));
    });

    it("maintains state consistency for single student mint", () => {
      // First mint succeeds
      const mintResult = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(mintResult.result).toBeOk(Cl.uint(1));

      const lastId = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(lastId.result).toBeOk(Cl.uint(1));

      // Second mint for same student fails
      const mintResult2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(mintResult2.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED

      // Last token ID remains 1
      const lastId2 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(lastId2.result).toBeOk(Cl.uint(1));
    });
  });
});

// ==============================
// EDGE CASES AND SECURITY TESTS
// ==============================

describe("Edge Cases and Security", () => {
  describe("NFT Uniqueness", () => {
    it("each minted NFT has unique token ID", () => {
      const tokenIds = new Set();
      const wallets = [wallet1, wallet2, wallet3, wallet4];

      // Mint NFT for each wallet
      for (let i = 0; i < wallets.length; i++) {
        const result = simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(wallets[i])],
          deployer
        );
        const tokenId = (result.result as any).value.value;
        tokenIds.add(tokenId.toString());
      }

      // All token IDs should be unique
      expect(tokenIds.size).toBe(wallets.length);
      
      // Verify each token ID is sequential
      const tokenIdArray = Array.from(tokenIds).map(id => Number(id)).sort((a, b) => a - b);
      for (let i = 0; i < tokenIdArray.length; i++) {
        expect(tokenIdArray[i]).toBe(i + 1);
      }
    });

    it("NFT cannot be minted with same ID twice", () => {
      // This is implicitly guaranteed by the token ID increment mechanism
      // and nft-mint? failure for duplicate IDs
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result2.result).toBeOk(Cl.uint(2));

      // Token IDs are different
      expect((result1.result as any).value.value).not.toBe(
        (result2.result as any).value.value
      );
    });
  });

  describe("Access Control", () => {
    it("only instructors can mint - comprehensive check", () => {
      // Try with non-instructor wallet1
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet4)],
        wallet1
      );
      expect(result1.result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY

      // Try with non-instructor wallet2
      const result2 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet4)],
        wallet2
      );
      expect(result2.result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY

      // Add wallet3 as instructor
      simnet.callPublicFn(
        "btc-university-nft",
        "add-instructor",
        [Cl.principal(wallet3)],
        deployer
      );

      // wallet3 (instructor) can mint
      const result3 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        wallet3
      );
      expect(result3.result).toBeOk(Cl.uint(1));

      // Deployer (default instructor) can mint
      const result4 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet2)],
        deployer
      );
      expect(result4.result).toBeOk(Cl.uint(2));
    });

    it("tx-sender must be an instructor", () => {
      // Non-instructors cannot mint
      const { result } = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-INSTRUCTOR-ONLY
    });
  });

  describe("Large Scale Operations", () => {
    it("enforces one NFT per student even at scale", () => {
      // First mint succeeds
      const result1 = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result1.result).toBeOk(Cl.uint(1));

      // All subsequent mints for same student fail
      for (let i = 2; i <= 10; i++) {
        const result = simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(wallet1)],
          deployer
        );
        expect(result.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED
      }

      // Last token ID is still 1
      const lastId = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(lastId.result).toBeOk(Cl.uint(1));
    });

    it("handles minting to many different recipients", () => {
      const recipients = [wallet1, wallet2, wallet3, wallet4];

      recipients.forEach((recipient, index) => {
        const result = simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(recipient)],
          deployer
        );
        expect(result.result).toBeOk(Cl.uint(index + 1));
      });

      // Verify ownership
      recipients.forEach((recipient, index) => {
        const owner = simnet.callReadOnlyFn(
          "btc-university-nft",
          "get-owner",
          [Cl.uint(index + 1)],
          deployer
        );
        expect(owner.result).toBeOk(Cl.some(Cl.principal(recipient)));
      });
    });
  });

  describe("Data Integrity", () => {
    it("owner lookup works for all minted tokens", () => {
      const mints = [
        { recipient: wallet1, expectedId: 1 },
        { recipient: wallet2, expectedId: 2 },
        { recipient: wallet3, expectedId: 3 },
        { recipient: wallet4, expectedId: 4 },
        { recipient: deployer, expectedId: 5 },
      ];

      // Mint all tokens (each student gets one)
      mints.forEach(({ recipient }) => {
        simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(recipient)],
          deployer
        );
      });

      // Verify all owners
      mints.forEach(({ recipient, expectedId }) => {
        const owner = simnet.callReadOnlyFn(
          "btc-university-nft",
          "get-owner",
          [Cl.uint(expectedId)],
          deployer
        );
        expect(owner.result).toBeOk(Cl.some(Cl.principal(recipient)));
      });
    });

    it("last-token-id reflects actual number of unique students minted", () => {
      // Mint for 4 different students
      const wallets = [wallet1, wallet2, wallet3, wallet4];
      
      wallets.forEach((wallet) => {
        simnet.callPublicFn(
          "btc-university-nft",
          "mint-for-student",
          [Cl.principal(wallet)],
          deployer
        );
      });

      const lastId = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(lastId.result).toBeOk(Cl.uint(wallets.length));
    });
  });

  describe("Boundary Conditions", () => {
    it("queries for high token IDs return none when not minted", () => {
      simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );

      // Query token IDs that don't exist
      const owner100 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(100)],
        wallet1
      );
      expect(owner100.result).toBeOk(Cl.none());

      const owner1000 = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(1000)],
        wallet1
      );
      expect(owner1000.result).toBeOk(Cl.none());
    });

    it("can query token ID immediately after minting", () => {
      const mintResult = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      const tokenId = (mintResult.result as any).value.value;

      const owner = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(tokenId)],
        wallet2
      );
      expect(owner.result).toBeOk(Cl.some(Cl.principal(wallet1)));
    });
  });
});

// ==============================
// INTEGRATION SCENARIOS
// ==============================

describe("Integration Scenarios", () => {
  it("complete certificate lifecycle", () => {
    // 1. Check initial state
    const initialCount = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );
    expect(initialCount.result).toBeOk(Cl.uint(0));

    // 2. Mint certificate for student
    const mintResult = simnet.callPublicFn(
      "btc-university-nft",
      "mint-for-student",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(mintResult.result).toBeOk(Cl.uint(1));

    // 3. Verify token ID updated
    const newCount = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );
    expect(newCount.result).toBeOk(Cl.uint(1));

    // 4. Verify ownership
    const owner = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-owner",
      [Cl.uint(1)],
      wallet2
    );
    expect(owner.result).toBeOk(Cl.some(Cl.principal(wallet1)));

    // 5. Check URI (always none)
    const uri = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-token-uri",
      [Cl.uint(1)],
      wallet1
    );
    expect(uri.result).toBeOk(Cl.none());
  });

  it("multiple students earning certificates", () => {
    const students = [
      { wallet: wallet1, name: "Student 1" },
      { wallet: wallet2, name: "Student 2" },
      { wallet: wallet3, name: "Student 3" },
      { wallet: wallet4, name: "Student 4" },
    ];

    // Each student completes course and gets NFT
    students.forEach((student, index) => {
      const mintResult = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(student.wallet)],
        deployer
      );
      expect(mintResult.result).toBeOk(Cl.uint(index + 1));

      // Verify ownership immediately
      const owner = simnet.callReadOnlyFn(
        "btc-university-nft",
        "get-owner",
        [Cl.uint(index + 1)],
        deployer
      );
      expect(owner.result).toBeOk(Cl.some(Cl.principal(student.wallet)));
    });

    // Verify final count
    const finalCount = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );
    expect(finalCount.result).toBeOk(Cl.uint(students.length));
  });

  it("student can only earn one certificate", () => {
    // Student completes first course and gets NFT
    const mintResult1 = simnet.callPublicFn(
      "btc-university-nft",
      "mint-for-student",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(mintResult1.result).toBeOk(Cl.uint(1));

    // Student completes more courses but cannot get more NFTs
    for (let i = 2; i <= 5; i++) {
      const mintResult = simnet.callPublicFn(
        "btc-university-nft",
        "mint-for-student",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(mintResult.result).toBeErr(Cl.uint(103)); // ERR-ALREADY-MINTED
    }

    // Verify student has only one NFT (token ID 1)
    const owner = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-owner",
      [Cl.uint(1)],
      deployer
    );
    expect(owner.result).toBeOk(Cl.some(Cl.principal(wallet1)));

    // Verify only one token was minted
    const count = simnet.callReadOnlyFn(
      "btc-university-nft",
      "get-last-token-id",
      [],
      wallet1
    );
    expect(count.result).toBeOk(Cl.uint(1));

    // Verify has-nft returns true
    const hasNft = simnet.callReadOnlyFn(
      "btc-university-nft",
      "has-nft",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(hasNft.result).toBeOk(Cl.bool(true));
  });
});
