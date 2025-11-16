;; sBTC Token Trait
;; Based on the actual sBTC contract interface on testnet/mainnet
;; The real sBTC uses get-balance-available, not standard SIP-010 get-balance

(define-trait sbtc-trait
  (
    ;; Transfer from the sender to a recipient
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    ;; Get the available balance of `owner` - REAL sBTC FUNCTION
    (get-balance-available (principal) (response uint uint))
  )
)

;; Legacy SIP-010 trait (kept for reference/mock)
(define-trait sip010-trait
  (
    ;; Transfer from the sender to a recipient
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    ;; Get the balance of `owner`
    (get-balance (principal) (response uint uint))
    ;; Get the total supply of the token
    (get-total-supply () (response uint uint))
    ;; Get the name of the token
    (get-name () (response (string-ascii 32) uint))
    ;; Get the symbol of the token
    (get-symbol () (response (string-ascii 32) uint))
    ;; Get the number of decimals used to represent the token
    (get-decimals () (response uint uint))
    ;; Get the URI for the token
    (get-token-uri () (response (optional (string-ascii 256)) uint))
  )
)
