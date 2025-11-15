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
(define-constant MIN-SBTC-BALANCE           u100000) ;; 0.001 BTC (100,000 satoshis)
(define-constant ERR-READING-SBTC-BALANCE   (err u7001))
(define-constant ERR-NOT-ENOUGH-SBTC        (err u7002))
(define-constant ERR-NOT-OWNER              (err u7003))

;; =========================
;; Data Variables & Constants
;; =========================
(define-constant UNI-OWNER tx-sender)
(define-constant CONTRACT-PRINCIPAL (as-contract tx-sender))
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
    )
    (if (>= user-sbtc-balance MIN-SBTC-BALANCE)
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

;; Get all courses (returns list of course IDs with their details)
(define-read-only (get-all-courses)
  (ok (map get-course-by-index (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20)))
)

;; Helper function to get course by index
(define-private (get-course-by-index (index uint))
  (if (<= index (var-get course-id))
    (map-get? courses { course-id: index })
    none
  )
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

;; Get all enrolled course IDs for a student
;; Returns a list of course IDs where the student is enrolled
(define-read-only (get-enrolled-ids (student principal))
  (let (
      (max-courses (var-get course-id))
      (result (fold append-if-enrolled (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20) 
                { student: student, max: max-courses, enrolled: (list) }))
    )
    (ok (get enrolled result))
  )
)

;; Helper fold function to build list of enrolled course IDs
(define-private (append-if-enrolled (cid uint) (acc { student: principal, max: uint, enrolled: (list 20 uint) }))
  (if (and (<= cid (get max acc))
           (is-some (map-get? enrollments { course-id: cid, student: (get student acc) })))
      { student: (get student acc), max: (get max acc), enrolled: (unwrap-panic (as-max-len? (append (get enrolled acc) cid) u20)) }
      acc
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
        (if (is-some (map-get? enrollments { course-id: enroll-course-id, student: tx-sender }))
            ERR-ALREADY-ENROLLED
            (begin
              ;; Transfer sBTC from student to contract escrow (4 arguments)
              (unwrap! 
                (contract-call? 
                  'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
                  transfer
                  (get price course)        ;; amount
                  tx-sender                 ;; sender
                  CONTRACT-PRINCIPAL        ;; recipient (contract escrow)
                  none                       ;; memo
                )
                ERR-NOT-ENOUGH-SBTC
              )

              ;; Record enrollment
              (map-set enrollments
                { course-id: enroll-course-id, student: tx-sender }
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
        (as-contract
          (contract-call?
            'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token
            transfer
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

