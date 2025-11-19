;; BTC University - Production Contract with Trait-Based sBTC
;; This version uses traits for dependency injection, making it testable

;; =========================
;; Error Codes
;; =========================
(define-constant ERR-INSTRUCTOR-ONLY       (err u100))
(define-constant ERR-COURSE-NOT-FOUND      (err u101))
(define-constant ERR-USER-NOT-WHITELISTED  (err u102))
(define-constant ERR-USER-NOT-ENROLLED     (err u103))
(define-constant ERR-ALREADY-ENROLLED      (err u104))
(define-constant ERR-NOT-ENOUGH-BALANCE    (err u107))
(define-constant ERR-UNAUTHORIZED          (err u108))
(define-constant ERR-INVALID-PRINCIPAL     (err u109))
(define-constant ERR-INVALID-AMOUNT        (err u110))

;; sBTC related constants
(define-constant MIN-SBTC-BALANCE           u100000) ;; 0.001 BTC (100,000 satoshis)
(define-constant ERR-READING-SBTC-BALANCE   (err u7001))
(define-constant ERR-NOT-ENOUGH-SBTC        (err u7002))
(define-constant ERR-NOT-OWNER              (err u7003))

;; =========================
;; Data Variables & Constants
;; =========================
(define-constant CONTRACT-DEPLOYER tx-sender)
(define-constant CONTRACT-PRINCIPAL (as-contract tx-sender))
(define-constant COURSE-PRICE u10000000)
(define-data-var course-id uint u0)

;; Import the sBTC trait (matches real sBTC contract)
(use-trait sbtc-trait .sip010-trait.sbtc-trait)

;; SECURITY: Store the official sBTC contract address
;; Owner sets this once during deployment/initialization
;; This prevents clients from passing fake sBTC contracts
(define-data-var sbtc-contract-address (optional principal) none)

;; Error for uninitialized sBTC contract
(define-constant ERR-SBTC-NOT-SET (err u7004))

;; =========================
;; Data Maps
;; =========================
(define-map instructors
  { instructor: principal }
  { authorized: bool }
)

(define-map whitelisted-beta 
  { student: principal } 
  { whitelisted: bool }
)

(define-map courses 
  { course-id: uint } 
  { name: (string-ascii 100), details: (string-ascii 256), price: uint, instructor: principal, max-students: uint }
)

(define-map enrollments 
  { course-id: uint, student: principal } 
  { paid: bool, enrolled: bool, completion: bool }
)

(define-map course-fees
  { course-id: uint }
  { total: uint }
)

(define-map meeting-links
  { course-id: uint }
  { link: (string-ascii 256) }
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
;; sBTC Configuration (SECURITY)
;; =========================

;; Instructor sets the official sBTC contract address
;; This MUST be called after deployment to enable sBTC functions
;; For testing: set to mock-sbtc-token
;; For production: set to official sBTC (ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token)
(define-public (set-sbtc-contract (new-sbtc-contract principal))
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    ;; Trust instructor to set valid contract address
    (var-set sbtc-contract-address (some new-sbtc-contract))
    (ok true)
  )
)

;; Read-only function to get configured sBTC contract
(define-read-only (get-sbtc-contract)
  (var-get sbtc-contract-address)
)

;; =========================
;; Whitelist Functions
;; =========================

;; User self-enroll to whitelist if enough sBTC balance
;; SECURITY: Uses owner-configured sBTC contract, not client-provided
(define-public (enroll-whitelist (sbtc-contract <sbtc-trait>))
  (let (
      (configured-sbtc (unwrap! (var-get sbtc-contract-address) ERR-SBTC-NOT-SET))
      (user-sbtc-balance 
        (unwrap! 
          (contract-call? sbtc-contract get-balance-available tx-sender)
          ERR-READING-SBTC-BALANCE
        )
      )
    )
    ;; SECURITY CHECK: Verify the passed contract matches the configured one
    (asserts! (is-eq (contract-of sbtc-contract) configured-sbtc) ERR-UNAUTHORIZED)
    
    (if (>= user-sbtc-balance MIN-SBTC-BALANCE)
        (begin
          (map-set whitelisted-beta { student: tx-sender } { whitelisted: true })
          (ok true))
        ERR-NOT-ENOUGH-SBTC
    )
  )
)

;; Instructor adds user to whitelist
(define-public (add-whitelist (student principal)) 
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    ;; Validate student is a standard principal
    (asserts! (is-standard student) ERR-INVALID-PRINCIPAL)
    (match (map-get? whitelisted-beta { student: student }) whitelisted
      (err u104)
      (begin
        (map-set whitelisted-beta { student: student } { whitelisted: true })
        (print "{student} Added to whitelist")
        (ok true)
      )
    )
  )
)

;; Instructor removes user from whitelist
(define-public (remove-whitelist (student principal)) 
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    ;; Validate student is a standard principal
    (asserts! (is-standard student) ERR-INVALID-PRINCIPAL)
    (match (map-get? whitelisted-beta { student: student }) whitelisted
      (begin
        (map-delete whitelisted-beta { student: student })
        (print "{student} Removed from whitelist")
        (ok true)
      )
      ERR-UNAUTHORIZED
    )
  )
)

;; Check if a user is whitelisted
(define-read-only (is-whitelisted-beta (student principal))
  (match (map-get? whitelisted-beta { student: student }) whitelisted
    (ok (get whitelisted whitelisted))
    ERR-USER-NOT-WHITELISTED
  )
)

;; =========================
;; Course Functions
;; =========================

;; Add or modify a course. If course-id is u0, creates new course. Otherwise updates existing course.
(define-public (add-course (id uint) (name (string-ascii 100)) (details (string-ascii 256)) (instructor principal) (price uint) (max-students uint))
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    ;; Validate instructor is a standard principal
    (asserts! (is-standard instructor) ERR-INVALID-PRINCIPAL)
    ;; Validate name and details are not empty
    (asserts! (> (len name) u0) ERR-INVALID-AMOUNT)
    (asserts! (> (len details) u0) ERR-INVALID-AMOUNT)
    ;; Note: price and max-students can be 0 (free courses, unlimited enrollment)
    
    (if (is-eq id u0)
      ;; Create new course
      (let ((new-course-id (+ (var-get course-id) u1)))
        (var-set course-id new-course-id)
        (map-set courses 
          { course-id: new-course-id } 
          { name: name, details: details, price: price, instructor: instructor, max-students: max-students }
        )
        (print { event: "course-added", course-id: new-course-id, name: name, by: tx-sender })
        (ok new-course-id)
      )
      ;; Update existing course
      (begin
        (asserts! (<= id (var-get course-id)) ERR-COURSE-NOT-FOUND)
        (map-set courses 
          { course-id: id } 
          { name: name, details: details, price: price, instructor: instructor, max-students: max-students }
        )
        (print { event: "course-updated", course-id: id, name: name, by: tx-sender })
        (ok id)
      )
    )
  )
)

(define-read-only (get-course-details (id uint))
  (ok (unwrap! (map-get? courses { course-id: id }) ERR-COURSE-NOT-FOUND))
)

(define-read-only (get-course-count)
  (ok (var-get course-id))
)

;; Set or update meeting link for a course
(define-public (set-meeting-link (id uint) (link (string-ascii 256)))
  (begin
    (asserts! (is-instructor tx-sender) ERR-INSTRUCTOR-ONLY)
    (asserts! (> id u0) ERR-INVALID-AMOUNT)
    (asserts! (<= id (var-get course-id)) ERR-COURSE-NOT-FOUND)
    (asserts! (> (len link) u0) ERR-INVALID-AMOUNT)
    (map-set meeting-links { course-id: id } { link: link })
    (print { event: "meeting-link-set", course-id: id, by: tx-sender })
    (ok true)
  )
)

;; Get meeting link for a course
(define-read-only (get-meeting-link (id uint))
  (ok (map-get? meeting-links { course-id: id }))
)

(define-read-only (get-all-courses)
  (ok (map get-course-by-index (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20)))
)

(define-private (get-course-by-index (index uint))
  (if (<= index (var-get course-id))
    (map-get? courses { course-id: index })
    none
  )
)

;; =========================
;; Enrollment Functions
;; =========================

(define-read-only (is-enrolled (id uint) (student principal))
  (match (map-get? enrollments { course-id: id, student: student }) enrollment
    (ok (get enrolled enrollment))
    ERR-USER-NOT-ENROLLED
  )
)

(define-read-only (get-enrolled-ids (student principal))
  (let (
      (max-courses (var-get course-id))
      (result (fold append-if-enrolled (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20) 
                { student: student, max: max-courses, enrolled: (list) }))
    )
    (ok (get enrolled result))
  )
)

(define-private (append-if-enrolled (cid uint) (acc { student: principal, max: uint, enrolled: (list 20 uint) }))
  (if (and (<= cid (get max acc))
           (is-some (map-get? enrollments { course-id: cid, student: (get student acc) })))
      { student: (get student acc), max: (get max acc), enrolled: (unwrap-panic (as-max-len? (append (get enrolled acc) cid) u20)) }
      acc
  )
)

(define-public (complete-course (id uint) (student principal))
  (let (
        (enrollment (map-get? enrollments { course-id: id, student: student }))
        (course (map-get? courses { course-id: id }))
      )
    ;; Validate student is a standard principal
    (asserts! (is-standard student) ERR-INVALID-PRINCIPAL)
    (asserts! (> id u0) ERR-INVALID-AMOUNT)
    (match enrollment enrollment-data
      (match course course-data
        (if (or (is-eq tx-sender (get instructor course-data))
                (is-instructor tx-sender))
          (begin
            (asserts! (get paid enrollment-data) ERR-UNAUTHORIZED)
            (asserts! (get enrolled enrollment-data) ERR-UNAUTHORIZED)
            (map-set enrollments 
              { course-id: id, student: student } 
              { paid: (get paid enrollment-data)
              , enrolled: (get enrolled enrollment-data)
              , completion: true })
            (ok true))
          (err u401))
        ERR-COURSE-NOT-FOUND)
      ERR-USER-NOT-ENROLLED)
  )
)

;; =========================
;; Enroll in a course using sBTC (with trait)
;; =========================
(define-public (enroll-course (enroll-course-id uint) (sbtc-contract <sbtc-trait>))
  (let (
        (configured-sbtc (unwrap! (var-get sbtc-contract-address) ERR-SBTC-NOT-SET))
        (course (unwrap! (map-get? courses { course-id: enroll-course-id }) ERR-COURSE-NOT-FOUND))
        (whitelist (unwrap! (map-get? whitelisted-beta { student: tx-sender }) ERR-USER-NOT-WHITELISTED))
        (course-price (get price course))
      )
    ;; SECURITY CHECK: Verify the passed contract matches the configured one
    (asserts! (is-eq (contract-of sbtc-contract) configured-sbtc) ERR-UNAUTHORIZED)
    (asserts! (> enroll-course-id u0) ERR-INVALID-AMOUNT)
    (asserts! (> course-price u0) ERR-INVALID-AMOUNT)
    
    (if (not (get whitelisted whitelist))
        ERR-USER-NOT-WHITELISTED
        (if (is-some (map-get? enrollments { course-id: enroll-course-id, student: tx-sender }))
            ERR-ALREADY-ENROLLED
            (begin
              ;; Transfer sBTC from student to contract escrow using trait
              (unwrap! 
                (contract-call? sbtc-contract transfer
                  course-price
                  tx-sender
                  CONTRACT-PRINCIPAL
                  none
                )
                ERR-NOT-ENOUGH-SBTC
              )

              ;; Record enrollment
              (map-set enrollments
                { course-id: enroll-course-id, student: tx-sender }
                { paid: true, enrolled: true, completion: false })

              ;; Add to course fees
              (let ((current-fees (default-to u0 (get total (map-get? course-fees { course-id: enroll-course-id })))))
                (map-set course-fees { course-id: enroll-course-id } { total: (+ current-fees course-price) })
              )

              (ok true)
            )
        )
    )
  )
)

;; =========================
;; Instructor claim function (with trait)
;; =========================
(define-public (claim-course-fees (courses-id uint) (sbtc-contract <sbtc-trait>))
  (let (
        (configured-sbtc (unwrap! (var-get sbtc-contract-address) ERR-SBTC-NOT-SET))
        (course (unwrap! (map-get? courses { course-id: courses-id }) ERR-COURSE-NOT-FOUND))
        (instructor (get instructor course))
      )
    ;; SECURITY CHECK: Verify the passed contract matches the configured one
    (asserts! (is-eq (contract-of sbtc-contract) configured-sbtc) ERR-UNAUTHORIZED)
    (asserts! (> courses-id u0) ERR-INVALID-AMOUNT)
    
    ;; Only instructor can claim
    (asserts! (is-eq tx-sender instructor) ERR-UNAUTHORIZED)

    ;; Get total fees for the course
    (let ((total-fees (default-to u0 (get total (map-get? course-fees { course-id: courses-id })))))
      
      ;; Note: total-fees can be 0, transfer will handle validation

      ;; Transfer total fees from contract escrow to instructor using trait
      (unwrap!
        (as-contract
          (contract-call? sbtc-contract transfer
            total-fees
            CONTRACT-PRINCIPAL
            instructor
            none
          )
        )
        ERR-NOT-ENOUGH-SBTC
      )

      ;; Reset fees after claiming
      (map-set course-fees { course-id: courses-id } { total: u0 })

      (ok total-fees)
    )
  )
)

