;; BTC University courses NFT contract
;; This contract allows minting of NFTs representing courses on the BTC University platform.

;;constants

(define-constant contract-owner  tx-sender)
(define-constant err-owner-only  (err u100))
(define-constant err-not-certi-holder  (err u101))


;;BTCuni NFT
(define-non-fungible-token BTCUni uint)

;;data variables

(define-data-var last-token-id uint u0)

;;read certificate id
(define-read-only (get-last-token-id)
	(ok (var-get last-token-id))
)

;; ;;get certi uri
(define-read-only (get-token-uri (token-id uint))
	(ok none)
)



;;get certi owner
(define-read-only (get-owner (certi-id uint))
	(ok (nft-get-owner? BTCUni certi-id))
)

;;mint certi
(define-public (mint (for principal))
	(let
		(
			(token-id (+ (var-get last-token-id) u1))
		)
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(try! (nft-mint? BTCUni token-id for))
		(var-set last-token-id token-id)
		(ok token-id)
	)
)

