# BTCUNI Smart Contract

BTCUNI is a decentralized learning platform implemented in Clarity on the Stacks blockchain. It allows instructors to create courses, students to enroll using sBTC, and supports a whitelist mechanism for beta access.

---

## Features

- **Whitelist System**  
  Students can self-enroll in a whitelist if they hold enough sBTC. The contract owner can also add or remove students from the whitelist.

- **Course Management**  
   the contract owner can create courses (with Instructor address) with a name, description, price, and maximum number of students.

- **Enrollment with sBTC**  
  Students can enroll in courses using sBTC. The contract handles sBTC transfers and maintains an escrow for course fees.

- **Completion Tracking**  
  Instructors or the contract owner can mark courses as completed for students.

- **Instructor Fee Claim**  
  Instructors can claim accumulated sBTC fees for their courses from the contract escrow.

---

## Deployment

1. Deploy the BTCUNI contract on the Stacks blockchain.
2. Ensure the sBTC token contract and oracle contract are deployed and accessible by the BTCUNI contract.
3. Set yourself as `UNI-OWNER` (contract deployer) for administrative functions.

---

## Contract Overview

### Constants & Error Codes

- `ERR-OWNER-ONLY (u100)` – Only contract owner can perform this action.
- `ERR-COURSE-NOT-FOUND (u101)` – Course ID does not exist.
- `ERR-USER-NOT-WHITELISTED (u102)` – User is not whitelisted for enrollment.
- `ERR-USER-NOT-ENROLLED (u103)` – Student is not enrolled in the course.
- `ERR-ALREADY-ENROLLED (u104)` – Student already enrolled.
- `ERR-NOT-ENOUGH-BALANCE (u107)` – Insufficient STX or sBTC balance.
- `ERR-UNAUTHORIZED (u108)` – Unauthorized access to the function.

sBTC constants:

- `MIN-SBTC-BALANCE` – Minimum USD value in sBTC required to join the whitelist.
- `SBTC-PRICE-EXPO` – Price exponent for conversion from sBTC to USD.

---

## Public Functions

### Whitelist Functions

- `enroll-whitelist ()` – Self-enroll in whitelist if user holds enough sBTC.  
- `add-whitelist (student principal)` – Owner adds a student to whitelist.  
- `remove-whitelist (student principal)` – Owner removes a student from whitelist.  
- `is-whitelisted-beta (student principal)` – Check if a student is whitelisted.  

### Course Functions

- `add-course (name string, details string, price uint, max-students uint)` – Owner adds a new course.  
- `get-course-details (id uint)` – Returns course information.  
- `get-course-count ()` – Returns total number of courses.  

### Enrollment Functions

- `enroll-course (course-id uint)` – Enroll a whitelisted student in a course using sBTC.  
- `is-enrolled (id uint, student principal)` – Check if a student is enrolled in a course.  
- `complete-course (id uint, student principal)` – Mark a student's course as completed.  

### Instructor Functions

- `claim-course-fees (course-id uint)` – Instructor claims accumulated sBTC fees for a course.

---

## Example Usage

```clarity
;; Enroll in whitelist
(enroll-whitelist)

;; Owner adds a student to whitelist
(add-whitelist 'ST12345...)

;; Add a new course
(add-course "Bitcoin Basics" "Learn the fundamentals of Bitcoin" u1000000 u50)

;; Enroll in a course
(enroll-course u1)

;; Mark course complete
(complete-course u1 'ST12345...)

;; Instructor claims fees
(claim-course-fees u1)
