;; BTC University courses NFT contract
;; This contract allows minting of NFTs representing course completion on the BTC University platform.

;;constants
(define-constant CONTRACT-DEPLOYER tx-sender)
(define-constant ERR-INSTRUCTOR-ONLY  (err u100))
(define-constant ERR-NOT-CERTI-HOLDER  (err u101))
(define-constant ERR-INVALID-PRINCIPAL  (err u102))
(define-constant ERR-ALREADY-MINTED  (err u103))

;;BTCuni NFT
(define-non-fungible-token BTCUni uint)

;;data variables
(define-data-var last-token-id uint u0)

;;data maps
;; Track instructors
(define-map instructors
  { instructor: principal }
  { authorized: bool }
)

;; Track which students have already received NFTs (one per student per contract)
(define-map student-nfts
  { student: principal }
  { token-id: uint, minted: bool }
)

;; =========================
;; Instructor Functions
;; =========================

;; Check if an address is an instructor (including deployer)
(define-read-only (is-instructor (address principal))
  (or 
    (is-eq address CONTRACT-DEPLOYER)
    (default-to false (get authorized (map-get? instructors { instructor: address })))
  )
)

;; Add a new instructor (only deployer or existing instructors)
(define-public (add-instructor (new-instructor principal))
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    (asserts! (is-standard new-instructor) ERR-INVALID-PRINCIPAL)
    (map-set instructors { instructor: new-instructor } { authorized: true })
    (print { event: "instructor-added", instructor: new-instructor, by: tx-sender })
    (ok true)
  )
)

;; =========================
;; Read-Only Functions
;; =========================

;;read certificate id
(define-read-only (get-last-token-id)
	(ok (var-get last-token-id))
)

;; get certi uri
(define-read-only (get-token-uri (token-id uint))
	(ok none)
)

;;get certi owner
(define-read-only (get-owner (certi-id uint))
	(ok (nft-get-owner? BTCUni certi-id))
)

;; Check if student has already received an NFT
(define-read-only (has-nft (student principal))
  (match (map-get? student-nfts { student: student })
    nft-data (ok (get minted nft-data))
    (ok false)
  )
)

;; Get the token ID for a student's NFT (if they have one)
(define-read-only (get-student-token-id (student principal))
  (ok (map-get? student-nfts { student: student }))
)

;; =========================
;; Mint Function
;; =========================

;; Instructor mints NFT for a student (one NFT per student per contract)
(define-public (mint-for-student (student principal))
	(let
		(
			(token-id (+ (var-get last-token-id) u1))
		)
		;; Only instructors can mint
		(asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
		;; Validate recipient is a standard principal
		(asserts! (is-standard student) ERR-INVALID-PRINCIPAL)
		;; Check if student already has an NFT
		(asserts! (is-none (map-get? student-nfts { student: student })) ERR-ALREADY-MINTED)
		;; Mint the NFT
		(try! (nft-mint? BTCUni token-id student))
		;; Update tracking
		(var-set last-token-id token-id)
		(map-set student-nfts { student: student } { token-id: token-id, minted: true })
		(print { event: "nft-minted", student: student, token-id: token-id, instructor: tx-sender })
		(ok token-id)
	)
)

