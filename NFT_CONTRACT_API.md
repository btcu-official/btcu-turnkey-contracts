# BTC University NFT Contract API

## Overview

The `btc-university-nft.clar` contract allows instructors to grant NFT certificates to students. Each student can receive only one NFT per contract, ensuring certificates represent overall achievement rather than per-course completion.

## Contract Functions

### Public Functions

#### `mint-for-student (student: principal)`

Mints an NFT certificate for a student.

**Authorization:** Instructors only
**Parameters:**
- `student` - The principal address of the student receiving the NFT

**Returns:** `(ok uint)` with the token ID, or an error

**Errors:**
- `u100` (ERR-INSTRUCTOR-ONLY) - Caller is not an instructor
- `u102` (ERR-INVALID-PRINCIPAL) - Invalid principal address
- `u103` (ERR-ALREADY-MINTED) - Student already has an NFT

**Example:**
```clarity
(contract-call? .btc-university-nft mint-for-student 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;; Returns: (ok u1)
```

#### `add-instructor (new-instructor: principal)`

Adds a new instructor who can mint NFTs.

**Authorization:** Instructors only (including deployer)
**Parameters:**
- `new-instructor` - The principal address to add as instructor

**Returns:** `(ok true)` or an error

**Errors:**
- `u100` (ERR-INSTRUCTOR-ONLY) - Caller is not an instructor
- `u102` (ERR-INVALID-PRINCIPAL) - Invalid principal address

**Example:**
```clarity
(contract-call? .btc-university-nft add-instructor 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;; Returns: (ok true)
```

### Read-Only Functions

#### `is-instructor (address: principal)`

Checks if an address is an instructor.

**Parameters:**
- `address` - The principal address to check

**Returns:** `bool` - `true` if instructor, `false` otherwise

**Example:**
```clarity
(contract-call? .btc-university-nft is-instructor 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
;; Returns: true (deployer is instructor by default)
```

#### `has-nft (student: principal)`

Checks if a student has already received an NFT.

**Parameters:**
- `student` - The principal address to check

**Returns:** `(ok bool)` - `true` if student has NFT, `false` otherwise

**Example:**
```clarity
(contract-call? .btc-university-nft has-nft 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;; Returns: (ok true)
```

#### `get-student-token-id (student: principal)`

Gets the token ID for a student's NFT.

**Parameters:**
- `student` - The principal address to query

**Returns:** `(ok (optional {token-id: uint, minted: bool}))` - NFT data if exists, `none` otherwise

**Example:**
```clarity
(contract-call? .btc-university-nft get-student-token-id 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;; Returns: (ok (some {token-id: u1, minted: true}))
```

#### `get-last-token-id ()`

Gets the last minted token ID.

**Returns:** `(ok uint)` - The last token ID minted

**Example:**
```clarity
(contract-call? .btc-university-nft get-last-token-id)
;; Returns: (ok u5)
```

#### `get-owner (certi-id: uint)`

Gets the owner of a specific NFT.

**Parameters:**
- `certi-id` - The token ID to query

**Returns:** `(ok (optional principal))` - Owner if exists, `none` otherwise

**Example:**
```clarity
(contract-call? .btc-university-nft get-owner u1)
;; Returns: (ok (some 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5))
```

#### `get-token-uri (token-id: uint)`

Gets the token URI (currently returns `none`).

**Parameters:**
- `token-id` - The token ID to query

**Returns:** `(ok none)`

## Usage Flow

### 1. Setup

The contract deployer is automatically an instructor. Add additional instructors:

```clarity
(contract-call? .btc-university-nft add-instructor 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
```

### 2. Check Student Status

Before minting, check if student already has an NFT:

```clarity
(contract-call? .btc-university-nft has-nft 'STUDENT-ADDRESS)
```

### 3. Mint Certificate

Mint NFT for a student:

```clarity
(contract-call? .btc-university-nft mint-for-student 'STUDENT-ADDRESS)
```

### 4. Verify Ownership

Verify the NFT was minted:

```clarity
(contract-call? .btc-university-nft get-student-token-id 'STUDENT-ADDRESS)
```

## Key Features

- **One NFT Per Student:** Each student can only receive one NFT, preventing duplicate certificates
- **Instructor Management:** Deployer can add other instructors who can mint NFTs
- **Simple Interface:** No complex conditions or requirements for minting
- **Transparent Tracking:** All NFT ownership and minting history is publicly queryable

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| u100 | ERR-INSTRUCTOR-ONLY | Only instructors can perform this action |
| u101 | ERR-NOT-CERTI-HOLDER | Unused (legacy) |
| u102 | ERR-INVALID-PRINCIPAL | Invalid principal address provided |
| u103 | ERR-ALREADY-MINTED | Student already has an NFT |

