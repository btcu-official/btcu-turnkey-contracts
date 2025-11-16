;; Mock sBTC Token Contract for Testing
;; This mimics the interface of the REAL sBTC token contract
;; Uses get-balance-available like the real sBTC
;; Only used in test environment

;; Import and implement the sBTC trait (matches real sBTC)
(impl-trait .sip010-trait.sbtc-trait)
;; Also implement SIP-010 for compatibility
(impl-trait .sip010-trait.sip010-trait)

;; Token definition
(define-fungible-token sbtc)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u402))
(define-constant ERR-INVALID-AMOUNT (err u403))
(define-constant ERR-INVALID-PRINCIPAL (err u404))

;; Data maps for balances
(define-map balances principal uint)

;; Initialize function - mint tokens to test wallets
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    ;; Validate recipient is a standard principal
    (asserts! (is-standard recipient) ERR-INVALID-PRINCIPAL)
    (try! (ft-mint? sbtc amount recipient))
    (ok true)
  )
)

;; Transfer function - mimics sBTC token transfer signature
;; (amount, sender, recipient, memo)
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    ;; Validate principals are standard
    (asserts! (is-standard sender) ERR-INVALID-PRINCIPAL)
    (asserts! (is-standard recipient) ERR-INVALID-PRINCIPAL)
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? sbtc amount sender recipient))
    (ok true)
  )
)

;; Get balance available - mimics sBTC token interface
(define-read-only (get-balance-available (account principal))
  (ok (ft-get-balance sbtc account))
)

;; SIP-010 required: get-balance (alias for get-balance-available)
(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sbtc account))
)

;; Get total supply
(define-read-only (get-total-supply)
  (ok (ft-get-supply sbtc))
)

;; Get token name
(define-read-only (get-name)
  (ok "sBTC")
)

;; Get token symbol
(define-read-only (get-symbol)
  (ok "sBTC")
)

;; Get decimals
(define-read-only (get-decimals)
  (ok u8)
)

;; Get token URI - SIP-010 required
(define-read-only (get-token-uri)
  (ok none)
)

