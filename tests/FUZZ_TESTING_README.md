# Fuzz Testing Documentation

## Overview

This directory contains fuzz tests for the BTC University smart contracts. Fuzz testing applies property-based testing techniques to automatically generate diverse test cases that verify invariants, boundary conditions, and state consistency across random operation sequences. This approach identifies edge cases and vulnerabilities that deterministic unit tests may not cover.

Smart contracts require rigorous testing due to their immutability after deployment, their role in handling valuable assets, their exposure to arbitrary public interaction patterns, and their complex state machine behaviors. Fuzz testing addresses these requirements by validating properties that must hold across all possible inputs and operation sequences.

## Test Results

The fuzz test suite consists of 42 tests that execute over 1,500 generated test cases in approximately 2.4 seconds. All tests pass without failures. The 42 tests are distributed across five categories: property-based tests (18 tests) validate invariants that must hold across all executions, boundary value tests (7 tests) examine behavior at extremes, invariant tests (7 tests) ensure consistency properties, sequence tests (6 tests) verify correctness under random operation orders, and stress tests (4 tests) validate behavior under load conditions.

## Test Coverage

The test suite validates security properties across all administrative functions, enforcing authorization requirements and balance constraints. Authorization checks ensure only authorized users can complete courses and that balance verification prevents overspending. State consistency is maintained through monotonic ID incrementation for both tokens and courses, with no gaps in sequences and definite whitelist state. Edge case handling covers zero values, maximum uint values (u128 max), and boundary conditions. Financial accuracy is verified through correct fee calculations where total fees equal the sum of enrollments, and instructor claim operations function correctly.

## Test Files

### btc-university.fuzz.test.ts

This file contains 21 fuzz tests covering the main university contract. Property-based tests verify that users with sufficient sBTC can self-enroll, that adding and removing users maintains consistent state, that whitelist status remains definite without intermediate states, that course IDs increment monotonically, that course details are retrievable after creation, that only whitelisted users with sufficient sBTC can enroll, that users cannot enroll twice in the same course, and that enrollment fees are tracked correctly.

Boundary value tests examine extreme uint values (0, u128 max), maximum string lengths (100 for names, 256 for details), edge case sBTC balances at threshold boundaries, and zero and maximum student limits. Invariant tests confirm that course count never decreases, that total course fees equal the sum of enrollments, and that user whitelist state remains consistent. Sequence-based tests execute random sequences of whitelist operations, random course additions and queries, complex workflows with multiple operations, and authorization checks across random operation sequences.

### btc-university-nft.fuzz.test.ts

This file contains 21 fuzz tests covering the NFT certificate contract. Property-based tests verify that each mint produces a unique token ID, that token IDs increment sequentially, that minted NFT owners are always the recipients, that the last token ID equals the number of mints, that only the deployer can mint, that unauthorized users always fail, that token URI always returns none, and that owner queries work correctly for both minted and unminted tokens.

Boundary value tests examine extreme token ID queries, large numbers of sequential mints (100+), and multiple mints to the same recipient. Invariant tests confirm that the last token ID never decreases, that token IDs are consecutive integers starting at 1, that each token has exactly one owner, and that total minted equals the last token ID. Sequence-based tests execute random mint and query sequences, interleaved mints to different recipients, and concurrent-style operations. Stress tests perform rapid consecutive mints (50+), random mixes of all operations, and validate error handling under chaotic conditions.

## Test Configuration

Tests use the fast-check library with configuration varying by test intensity. Most tests execute 10 runs, intensive tests execute 5 runs, and simple tests execute 20-30 runs. Property-based tests verify that invariants hold across random valid inputs. Boundary tests examine behavior at extreme values. Sequence tests validate operation ordering. Invariant tests confirm conditions that must always hold. Stress tests evaluate performance under load.

## Execution

Run all fuzz tests with `npm run test:fuzz`. For verbose output, use `npm run test:fuzz:verbose`. Execute both unit and fuzz tests with `npm test`. For watch mode, use `npm run test:fuzz:watch`. For coverage reports, use `npm run test:report`.

The test:fuzz command applies a filter that executes only tests containing FUZZ, PROPERTY, INVARIANT, STRESS, or CHAOS in their names. This filter causes vitest to skip the unit tests in btc-university.test.ts and btc-university-nft.test.ts, while executing the other fuzz tests across btc-university.fuzz.test.ts and btc-university-nft.fuzz.test.ts. The skipped tests remain part of the test suite and execute when running npm test without filters. This separation allows developers to run comprehensive fuzz tests independently from faster unit tests during development workflows.

## Testing Patterns

Property-based testing uses fast-check to generate random inputs within specified constraints and verify that properties hold for all generated cases. Invariant testing validates that specific conditions always hold regardless of operations performed. Sequence testing generates arrays of random operations to verify that the system maintains correctness under arbitrary operation orders.

Example property-based test structure:

```typescript
fc.assert(
  fc.property(fc.integer({ min: 100000, max: 10000000 }), (amount) => {
    // Test logic verifying property holds for all amounts
  }),
  { numRuns: 10 }
);
```

Example sequence test structure:

```typescript
fc.array(
  fc.record({
    action: fc.constantFrom("add", "remove", "check"),
    wallet: fc.constantFrom(wallet1, wallet2, wallet3),
  }),
  { minLength: 10, maxLength: 30 }
);
```

## Test Output Interpretation

Property-based tests display the number of runs and whether all properties were satisfied. Failed tests indicate which property was violated, after how many runs the failure occurred, and provide the specific input that caused the failure (counterexample). This information enables rapid identification and reproduction of edge cases.

## Performance Characteristics

Fuzz tests are more intensive than unit tests due to the volume of generated test cases. Unit tests typically execute 100-500 test cases in 2-5 seconds. Fuzz tests generate 1,000-5,000 test cases and execute in 10-30 seconds. The complete test suite (unit and fuzz tests combined) executes in 30-60 seconds.

## Extending the Test Suite

To add new fuzz tests, identify properties that should always hold or invariants that must be maintained. Select the appropriate test type based on whether the test validates properties with random valid inputs (property-based), examines behavior at extreme values (boundary), verifies operation ordering (sequence), or confirms conditions that always hold (invariant). Write tests that verify one clear property per test, choose appropriate random value generators from the fast-check library, and document edge cases in comments.

## Common Issues and Resolution

Test timeouts indicate that numRuns should be reduced or operations simplified. Flaky tests suggest improper state reset, invalid random value ranges, or hidden state dependencies. High failure rates indicate issues with contract logic, mismatched error codes, or incorrect test setup.

## Resources

Technical documentation and best practices are available through fast-check documentation (github.com/dubzzz/fast-check), property-based testing literature (hypothesis.works/articles/what-is-property-based-testing/), smart contract security guidelines (consensys.github.io/smart-contract-best-practices/), and fuzz testing best practices (owasp.org/www-community/Fuzzing).

## Implementation Files

The implementation consists of three primary files: `tests/btc-university.fuzz.test.ts` containing 21 fuzz tests, `tests/btc-university-nft.fuzz.test.ts` containing 21 fuzz tests, and this documentation file.
