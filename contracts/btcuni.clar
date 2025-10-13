;; =========================
;; Trait Import
;; =========================
(impl-trait .btcuni-trait.BTCUNI)


;; =========================
;; Error Codes
;; =========================
(define-constant ERR-OWNER-ONLY            (err u100))
(define-constant ERR-COURSE-NOT-FOUND      (err u101))
(define-constant ERR-USER-NOT-WHITELISTED  (err u102))
(define-constant ERR-USER-NOT-ENROLLED     (err u103))
(define-constant ERR-ALREADY-ENROLLED      (err u104))
(define-constant ERR-NOT-ENOUGH-BALANCE    (err u107))
(define-constant ERR-UNAUTHORIZED          (err u108))

;; sBTC related constants
(define-constant MIN-SBTC-BALANCE           u10) ;; 10 USD
(define-constant ERR-READING-SBTC-BALANCE   (err u7001))
(define-constant ERR-NOT-ENOUGH-SBTC        (err u7002))
(define-constant ERR-NOT-OWNER              (err u7003))
(define-constant SBTC-PRICE-EXPO            u8)

;; =========================
;; Data Variables & Constants
;; =========================
(define-constant UNI-OWNER tx-sender)
(define-constant COURSE-PRICE u10000000) ;; 1 USD in micro units
(define-data-var course-id uint u0)


;; =========================
;; Data Maps
;; =========================
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

(define-map student-courses
  { student: principal, course-id: uint }
  { paid: bool, enrolled: bool, completion: bool }
)

(define-map course-fees
  { course-id: uint }
  { total: uint }
)


;; =========================
;; Whitelist Functions
;; =========================

;; User self-enroll to whitelist if enough sBTC balance
(define-public (enroll-whitelist)
  (let (
      (sbtc-price-data 
        (unwrap-panic 
          (contract-call? 'ST1S5ZGRZV5K4S9205RWPRTX9RGS9JV40KQMR4G1J.dia-oracle
            get-value 
            "sBTC/USD"
          )
        )
      )
      (sbtc-price (get value sbtc-price-data))
      (price-denominator (pow u10 SBTC-PRICE-EXPO))
      (user-sbtc-balance 
        (unwrap! 
          (contract-call? 
            'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
            get-balance-available 
            tx-sender
          )
          ERR-READING-SBTC-BALANCE
        )
      )
      (user-usd-value (/ (* user-sbtc-balance sbtc-price) price-denominator))
      (min-usd-value (* MIN-SBTC-BALANCE price-denominator))
    )
    (if (>= user-usd-value min-usd-value)
        (begin
          (map-set whitelisted-beta { student: tx-sender } { whitelisted: true })
          (ok true))
        ERR-NOT-ENOUGH-SBTC
    )
  )
)

;; Owner adds user to whitelist
(define-public (add-whitelist (student principal)) 
  (begin
    (asserts! (is-eq tx-sender UNI-OWNER) ERR-OWNER-ONLY)
    (match (map-get? whitelisted-beta { student: student }) whitelisted
      (err u104) ;; Already whitelisted
      (begin
        (map-set whitelisted-beta { student: student } { whitelisted: true })
        (print "{student} Added to whitelist")
        (ok true)
      )
    )
  )
)

;; Owner removes user from whitelist
(define-public (remove-whitelist (student principal)) 
  (begin
    (asserts! (is-eq tx-sender UNI-OWNER) ERR-OWNER-ONLY)
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

;; Owner adds a course
(define-public (add-course (name (string-ascii 100)) (details (string-ascii 256)) (instructor principal) (price uint) (max-students uint))
  (begin
    (asserts! (is-eq tx-sender UNI-OWNER) ERR-OWNER-ONLY)
    (let ((new-course-id (+ (var-get course-id) u1)))
      (var-set course-id new-course-id)
      (map-set courses 
        { course-id: new-course-id } 
        { name: name, details: details, price: price, instructor: instructor, max-students: max-students }
      )
      (print "{tx-sender} Added course {name} with id {new-course-id}")
      (ok new-course-id)
    )
  )
)

;; Get course details
(define-read-only (get-course-details (id uint))
  (ok (unwrap! (map-get? courses { course-id: id }) ERR-COURSE-NOT-FOUND))
)

;; Get total number of courses
(define-read-only (get-course-count)
  (ok (var-get course-id))
)

;; =========================
;; Enrollment Functions
;; =========================

;; Check if a student is enrolled
(define-read-only (is-enrolled (id uint) (student principal))
  (match (map-get? enrollments { course-id: id, student: student }) enrollment
    (ok (get enrolled enrollment))
    ERR-USER-NOT-ENROLLED
  )
)

;; Complete a course
(define-public (complete-course (id uint) (student principal))
  (let (
        (enrollment (map-get? enrollments { course-id: id, student: student }))
        (course (map-get? courses { course-id: id }))
      )
    (match enrollment enrollment-data
      (match course course-data
        (if (or (is-eq tx-sender (get instructor course-data))
                (is-eq tx-sender UNI-OWNER))
          (begin
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
;; Enroll in a course using sBTC
;; =========================
(define-public (enroll-course (enroll-course-id uint))
  (let (
        (course (unwrap! (map-get? courses { course-id: enroll-course-id }) ERR-COURSE-NOT-FOUND))
        (whitelist (unwrap! (map-get? whitelisted-beta { student: tx-sender }) ERR-USER-NOT-WHITELISTED))
      )
    (if (not (get whitelisted whitelist))
        ERR-USER-NOT-WHITELISTED
        (if (is-some (map-get? student-courses { student: tx-sender, course-id: enroll-course-id }))
            ERR-ALREADY-ENROLLED
            (begin
              ;; Transfer sBTC from student to contract escrow (4 arguments)
              (unwrap! 
                (contract-call? 
                  'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
                  transfer
                  (get price course)        ;; amount
                  tx-sender                 ;; sender
                  (as-contract tx-sender)   ;; recipient (contract escrow)
                  none                       ;; memo
                )
                ERR-NOT-ENOUGH-SBTC
              )

              ;; Record enrollment
              (map-set student-courses
                { student: tx-sender, course-id: enroll-course-id }
                { paid: true, enrolled: true, completion: false })

              ;; Add to course fees
              (let ((current-fees (default-to u0 (get total (map-get? course-fees { course-id: enroll-course-id })))))
                (map-set course-fees { course-id: enroll-course-id } { total: (+ current-fees (get price course)) })
              )

              (ok true)
            )
        )
    )
  )
)



;; =========================
;; Instructor claim function
;; =========================
(define-public (claim-course-fees (courses-id uint))
  (let (
        (course (unwrap! (map-get? courses { course-id: courses-id }) ERR-COURSE-NOT-FOUND))
        (instructor (get instructor course))
      )
    ;; Only instructor can claim
    (asserts! (is-eq tx-sender instructor) ERR-UNAUTHORIZED)

    ;; Get total fees for the course
    (let ((total-fees (default-to u0 (get total (map-get? course-fees { course-id: courses-id })))))

      ;; Transfer total fees from contract escrow to instructor
      (unwrap!
        (contract-call?
          'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
          transfer
          total-fees
          (as-contract tx-sender)
          tx-sender
          
          none
        )
        ERR-NOT-ENOUGH-SBTC
      )

      ;; Reset fees after claiming
      (map-set course-fees { course-id: courses-id } { total: u0 })

      (ok total-fees)
    )
  )
)

