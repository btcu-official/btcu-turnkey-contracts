(define-trait BTCUNI
(
    (enroll-whitelist () (response bool uint))

   (add-whitelist (principal) (response bool uint))
   
    (enroll-course (uint) (response bool uint))
(remove-whitelist (principal) (response bool uint))

  
  ) 
)