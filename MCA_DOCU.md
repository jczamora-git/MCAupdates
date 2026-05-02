# MCA Project Documentation (MCA_DOCU)

## Project Overview
Campus Companion is a full-stack school management system with:
- A React + Vite frontend (EduTrackUI)
- A PHP MVC backend (LavaLust)
- ML services for sentiment analysis and predictive analytics

Core domains include enrollment, payments, learning materials, grade transparency, attendance, messaging, and notifications.

## Workspace Layout
- Frontend: [EduTrackUI](EduTrackUI)
- Backend: [LavaLust](LavaLust)
- ML services: [ML](ML)
- Deployment guide: [DEV_LIVE_DEPLOYMENT_SETUP.md](DEV_LIVE_DEPLOYMENT_SETUP.md)

## Frontend (EduTrackUI)
- Stack: Vite, React, TypeScript, Tailwind CSS, shadcn-ui.
- Environment variables:
  - `VITE_API_BASE_URL` for the PHP backend base URL.
  - `VITE_SENTIMENT_API_URL` for the sentiment proxy URL.
- Build output is expected in `EduTrackUI/dist` for deployment.

Source: [EduTrackUI/README.md](EduTrackUI/README.md)

## Backend (LavaLust)
- Framework: LavaLust (PHP MVC).
- Routes are defined in [LavaLust/app/config/routes.php](LavaLust/app/config/routes.php).
- Common helpers and models are auto-loaded in [LavaLust/app/config/autoload.php](LavaLust/app/config/autoload.php).

Source: [LavaLust/README.md](LavaLust/README.md)

## ML Services
### Sentiment Analysis (PHP Proxy)
- The backend proxies sentiment requests to either a local model or Hugging Face.
- Modes: local, external, or auto.
- API endpoints (via PHP backend):
  - `GET /api/sentiment/health`
  - `POST /api/sentiment/predict`
  - `POST /api/sentiment/predict/batch`
  - `POST /api/insights/weekly`

Source: [LavaLust/SENTIMENT_API_README.md](LavaLust/SENTIMENT_API_README.md)

### Predictive Analytics (Flask + PHP)
Two implementations exist under [ML/Predictive_Analytics/api](ML/Predictive_Analytics/api):
- `app.py` (Flask API)
- `index.php` (PHP proxy calling Python predictor)

Flask endpoints (app.py):
- `GET /api/grades`
- `GET /api/predict?year=YYYY&grade=NAME`
- `GET /api/predict/all?year=YYYY`
- `GET /api/forecast?grade=NAME&years=N`
- `GET /api/forecast/all?years=N`
- `GET /api/payment/predict?year=YYYY`
- `GET /api/payment/forecast?years=N`
- `GET /api/historical`
- `GET /api/metrics`
- `GET /api/analysis/minmax`
- `GET /api/forecast/minmax?years=N&start_year=YYYY`

PHP proxy endpoints (index.php):
- `GET /api/enrollment/predict`
- `GET /api/enrollment/forecast`
- `GET /api/forecast`
- `GET /api/forecast/all`
- `GET /api/payment/predict`
- `GET /api/payment/forecast`
- `GET /api/historical`
- `GET /api/analysis`
- `GET /api/analysis/trends`
- `GET /api/metrics`
- `GET /api/health`

Sources:
- [ML/Predictive_Analytics/api/app.py](ML/Predictive_Analytics/api/app.py)
- [ML/Predictive_Analytics/api/index.php](ML/Predictive_Analytics/api/index.php)
- [ML/Predictive_Analytics/api/predictor.py](ML/Predictive_Analytics/api/predictor.py)

## Deployment Summary
- Live domain: `mcaportal.online` maps backend to `public_html` and frontend to `public_html/ui`.
- Dev domain: `dev.mcaportal.online` maps backend to `public_html/dev` and frontend to `public_html/dev/ui`.
- Dev and live must be isolated for DB, uploads, logs, and cron jobs.

Source: [DEV_LIVE_DEPLOYMENT_SETUP.md](DEV_LIVE_DEPLOYMENT_SETUP.md)

## Documentation Notes (Markdown Summary)
- [DEV_LIVE_DEPLOYMENT_SETUP.md](DEV_LIVE_DEPLOYMENT_SETUP.md): Live vs dev deployment mapping and safety rules.
- [EduTrackUI/README.md](EduTrackUI/README.md): Frontend stack, env vars, and build instructions.
- [LavaLust/README.md](LavaLust/README.md): LavaLust framework details and license.
- [LavaLust/SENTIMENT_API_README.md](LavaLust/SENTIMENT_API_README.md): Sentiment proxy configuration and endpoints.
- [LavaLust/PROOF_OF_PAYMENT_README.md](LavaLust/PROOF_OF_PAYMENT_README.md): Payment proof upload flow and endpoints.
- [LavaLust/TRANSACTION_SAFETY_GUIDE.md](LavaLust/TRANSACTION_SAFETY_GUIDE.md): Transactions, idempotency, and locking.
- [LavaLust/IMPLEMENTATION_CHECKLIST.md](LavaLust/IMPLEMENTATION_CHECKLIST.md): Migration and controller update checklist.
- [LavaLust/NOTIFICATION_TEMPLATES.md](LavaLust/NOTIFICATION_TEMPLATES.md): Notification message templates and types.

## API Inventory and Controller to Model Mapping
Note: Model links are based on naming conventions and the model registry in [LavaLust/app/models](LavaLust/app/models). Controllers may use multiple models in practice.

### Core Routes
- `GET /` -> `Welcome::index`

### Auth and Users
- `/auth/login` `GET|POST` -> `UserController::login` -> UserModel
- `/auth/register` `GET|POST` -> `UserController::register` -> UserModel
- `/auth/logout` `GET` -> `UserController::logout` -> UserModel
- `/auth/reset` `GET|POST` -> `UserController::reset` -> UserModel

- `POST /api/auth/register` -> `UserController::api_register` -> UserModel
- `POST /api/auth/login` -> `UserController::api_login` -> UserModel
- `POST /api/auth/check-student` -> `UserController::api_check_student` -> UserModel, StudentModel
- `POST /api/auth/set-password` -> `UserController::api_set_password` -> UserModel
- `POST /api/auth/logout` -> `UserController::api_logout` -> UserModel
- `GET /api/auth/me` -> `UserController::me` -> UserModel
- `GET /api/auth/check` -> `UserController::check` -> UserModel
- `PUT /api/auth/profile` -> `UserController::api_update_my_profile` -> UserModel
- `POST /api/auth/setup-payment-pin` -> `UserController::api_setup_payment_pin` -> UserModel
- `POST /api/auth/verify-payment-pin` -> `UserController::api_verify_payment_pin` -> UserModel
- `POST /api/auth/request-pin-reset` -> `UserController::api_request_pin_reset` -> UserModel
- `POST /api/auth/verify-pin-reset-token` -> `UserController::api_verify_pin_reset_token` -> UserModel
- `POST /api/auth/reset-pin` -> `UserController::api_reset_pin` -> UserModel
- `POST /api/auth/request-reset` -> `UserController::api_request_password_reset` -> UserModel
- `POST /api/auth/reset-password` -> `UserController::api_reset_password` -> UserModel
- `POST /api/auth/validate-set-password-token` -> `UserController::api_validate_set_password_token` -> UserModel
- `POST /api/auth/set-password-with-token` -> `UserController::api_set_password_with_token` -> UserModel
- `POST /api/auth/send-welcome-email` -> `UserController::api_send_welcome_email` -> UserModel

- `GET /api/users/verify-email` -> `UserController::api_verify_email` -> UserModel
- `POST /api/users/resend-verification` -> `UserController::api_resend_verification` -> UserModel

- `GET /api/users` -> `UserController::api_get_users` -> UserModel
- `POST /api/users/{id}/send-password-reset` -> `UserController::api_admin_send_password_reset` -> UserModel
- `GET /api/users/{id}` -> `UserController::api_get_user` -> UserModel
- `POST /api/users` -> `UserController::api_create_user` -> UserModel
- `PUT /api/users/{id}` -> `UserController::api_update_user` -> UserModel
- `DELETE /api/users/{id}` -> `UserController::api_delete_user` -> UserModel

### Config and Feature Flags
- `GET /api/config/features` -> `ConfigController::api_get_features` -> feature helper
- `GET /api/config/enrollment-types` -> `ConfigController::api_get_enrollment_types` -> feature helper

### Notifications and FCM
- `POST /api/users/register-fcm-token` -> `NotificationController::api_register_fcm_token` -> NotificationService
- `GET /api/debug/my-fcm-tokens` -> `NotificationController::api_list_my_fcm_tokens` -> NotificationService
- `POST /api/debug/send-test-notification` -> `NotificationController::api_send_test_notification` -> NotificationService
- `GET /api/debug/send-test-notification` -> `NotificationController::api_send_test_notification` -> NotificationService

- `GET /api/notifications` -> `NotificationController::api_get_notifications` -> NotificationService
- `GET /api/notifications/unread-count` -> `NotificationController::api_get_unread_count` -> NotificationService
- `POST /api/notifications/{id}/mark-as-read` -> `NotificationController::api_mark_as_read` -> NotificationService
- `POST /api/notifications/mark-all-as-read` -> `NotificationController::api_mark_all_as_read` -> NotificationService
- `GET /api/notifications/audit-logs` -> `NotificationController::api_get_audit_logs` -> NotificationService
- `GET /api/notifications/stats` -> `NotificationController::api_get_stats` -> NotificationService

### Teachers
- `GET /api/teachers` -> `TeacherController::api_get_teachers` -> TeacherModel
- `GET /api/teachers/stats` -> `TeacherController::api_teacher_stats` -> TeacherModel
- `GET /api/teachers/last-id` -> `TeacherController::api_get_last_id` -> TeacherModel
- `GET /api/teacher-assignments` -> `TeacherController::api_get_all_assignments` -> TeacherSubjectAssignmentModel
- `GET /api/teachers/by-user/{user_id}` -> `TeacherController::api_get_teacher_by_user` -> TeacherModel
- `GET /api/teachers/{id}/assignment` -> `TeacherController::api_get_teacher_assignment` -> TeacherSubjectAssignmentModel
- `GET /api/teachers/{id}/public` -> `TeacherController::api_get_public_teacher` -> TeacherModel
- `GET /api/teachers/{id}` -> `TeacherController::api_get_teacher` -> TeacherModel
- `POST /api/teachers` -> `TeacherController::api_create_teacher` -> TeacherModel
- `PUT /api/teachers/{id}` -> `TeacherController::api_update_teacher` -> TeacherModel
- `DELETE /api/teachers/{id}` -> `TeacherController::api_delete_teacher` -> TeacherModel

- `GET /api/teacher-assignments/for-student` -> `TeacherAssignmentController::api_get_for_student` -> TeacherSubjectAssignmentModel

- `GET /api/teacher-assignments/my` -> `TeacherController::api_get_my_assignment` -> TeacherSubjectAssignmentModel
- `GET /api/teachers/sections-by-year-level` -> `TeacherController::api_get_sections_by_year_level` -> SectionModel, YearLevelSectionModel
- `GET /api/teachers/me/adviser-levels` -> `TeacherController::api_get_my_adviser_levels` -> TeacherAdviserAssignmentModel
- `GET /api/teachers/me/subjects` -> `TeacherController::api_get_my_subjects` -> TeacherSubjectModel
- `GET /api/teachers/advisers` -> `TeacherController::api_get_advisers` -> TeacherAdviserAssignmentModel
- `GET /api/teachers/assignments` -> `TeacherController::api_get_assignments` -> TeacherSubjectAssignmentModel
- `POST /api/teachers/assign-adviser` -> `TeacherController::api_assign_adviser` -> TeacherAdviserAssignmentModel
- `POST /api/teachers/assign-subject` -> `TeacherController::api_assign_subject` -> TeacherSubjectAssignmentModel
- `GET /api/teachers/{id}/subjects` -> `TeacherController::api_get_teacher_subjects` -> TeacherSubjectModel
- `DELETE /api/teachers/assignment` -> `TeacherController::api_remove_assignment` -> TeacherSubjectAssignmentModel
- `GET /api/teacher-subject-assignments` -> `TeacherController::api_get_subject_teachers` -> TeacherSubjectAssignmentModel

### Students
- `GET /api/students` -> `StudentController::api_get_students` -> StudentModel
- `GET /api/students-enrollees` -> `StudentController::api_get_students_enrollees` -> StudentModel
- `GET /api/students/stats` -> `StudentController::api_get_stats` -> StudentModel
- `GET /api/students/last-id` -> `StudentController::api_get_last_id` -> StudentModel
- `GET /api/students/active` -> `StudentController::api_get_active_students` -> StudentModel
- `GET /api/rfid/cards/check` -> `StudentController::api_check_rfid` -> RFIDScanModel
- `GET /api/students/by-user/{user_id}` -> `StudentController::api_get_by_user_id` -> StudentModel
- `GET /api/students/{id}/courses` -> `StudentController::api_get_courses_for_student` -> StudentSubjectModel
- `GET /api/students/{id}/courses/teachers` -> `StudentController::api_get_course_teachers` -> TeacherSubjectModel
- `GET /api/students/{id}/activities` -> `StudentController::api_get_activities_for_student` -> ActivityModel
- `GET /api/students/{id}/courses-activities` -> `StudentController::api_get_courses_activities` -> ActivityModel
- `GET /api/students/{id}` -> `StudentController::api_get_student` -> StudentModel
- `POST /api/students` -> `StudentController::api_create_student` -> StudentModel
- `GET /api/students/export` -> `StudentController::api_export_students` -> StudentModel
- `POST /api/students/import` -> `StudentController::api_import_students` -> StudentModel
- `PUT /api/students/{id}` -> `StudentController::api_update_student` -> StudentModel
- `POST /api/students/{id}/rfid` -> `StudentController::api_assign_rfid` -> RFIDScanModel
- `DELETE /api/students/{id}` -> `StudentController::api_delete_student` -> StudentModel
- `POST /api/students/send-welcome-email` -> `StudentController::api_send_welcome_email` -> StudentModel
- `GET /api/student/grades-summary` -> `StudentController::api_grades_summary` -> FinalGradesModel

### Sections and Year Levels
- `GET /api/sections` -> `SectionController::api_get_sections` -> SectionModel
- `GET /api/sections/{id}` -> `SectionController::api_get_section` -> SectionModel
- `POST /api/sections` -> `SectionController::api_create_section` -> SectionModel
- `POST /api/sections/with-year-level` -> `SectionController::api_create_section_with_year_level` -> SectionModel, YearLevelSectionModel
- `PUT /api/sections/{id}` -> `SectionController::api_update_section` -> SectionModel
- `DELETE /api/sections/{id}` -> `SectionController::api_delete_section` -> SectionModel

- `GET /api/year-levels` -> `SectionController::api_get_year_levels` -> YearLevelModel
- `POST /api/year-levels` -> `SectionController::api_create_year_level` -> YearLevelModel
- `PUT /api/year-levels/{id}` -> `SectionController::api_update_year_level` -> YearLevelModel
- `DELETE /api/year-levels/{id}` -> `SectionController::api_delete_year_level` -> YearLevelModel
- `GET /api/year-levels/{id}/sections` -> `SectionController::api_get_year_level_sections` -> YearLevelSectionModel
- `POST /api/year-levels/{yearLevelId}/sections` -> `SectionController::api_create_section_under_year_level` -> YearLevelSectionModel

- `GET /api/year-level-sections` -> `SectionController::api_get_all_year_level_sections` -> YearLevelSectionModel
- `POST /api/year-levels/{yearLevelId}/sections/{sectionId}` -> `SectionController::api_assign_section_to_year_level` -> YearLevelSectionModel
- `DELETE /api/year-levels/{yearLevelId}/sections/{sectionId}` -> `SectionController::api_unassign_section_from_year_level` -> YearLevelSectionModel

### Subjects and Student Subjects
- `GET /api/subjects` -> `SubjectController::api_get_subjects` -> SubjectModel
- `GET /api/subjects/{id}` -> `SubjectController::api_get_subject` -> SubjectModel
- `POST /api/subjects` -> `SubjectController::api_create_subject` -> SubjectModel
- `PUT /api/subjects/{id}` -> `SubjectController::api_update_subject` -> SubjectModel
- `DELETE /api/subjects/{id}` -> `SubjectController::api_delete_subject` -> SubjectModel
- `GET /api/subjects/for-student` -> `SubjectController::api_get_for_student` -> SubjectModel

- `GET /api/student-subjects` -> `StudentSubjectController::api_get` -> StudentSubjectModel
- `POST /api/student-subjects` -> `StudentSubjectController::api_create` -> StudentSubjectModel
- `POST /api/student-subjects/delete` -> `StudentSubjectController::api_delete` -> StudentSubjectModel

### Activities, Grading, and Quizzes
- `GET /api/activities` -> `ActivityController::api_get_activities` -> ActivityModel
- `GET /api/teacher/activities/with-grades` -> `ActivityController::api_get_teacher_activities_with_graded_counts` -> ActivityModel
- `GET /api/activities/course/with-stats` -> `ActivityController::api_get_course_activities_with_stats` -> ActivityModel
- `GET /api/activities/student-grades` -> `ActivityController::api_get_student_activities_with_grades` -> ActivityModel
- `GET /api/activities/student-all` -> `ActivityController::api_get_all_student_activities_with_grades` -> ActivityModel
- `GET /api/activities/student-sidebar-grades` -> `ActivityController::api_get_student_sidebar_grades` -> ActivityModel
- `GET /api/activities/export-class-record` -> `ActivityController::api_export_class_record` -> ActivityModel
- `GET /api/activities/export-class-record-excel` -> `ActivityController::api_export_class_record_excel` -> ActivityModel
- `POST /api/activities/import-class-record` -> `ActivityController::api_import_class_record` -> ActivityModel
- `GET /api/activities/{id}` -> `ActivityController::api_get_activity` -> ActivityModel
- `POST /api/activities` -> `ActivityController::api_create_activity` -> ActivityModel
- `PUT /api/activities/{id}` -> `ActivityController::api_update_activity` -> ActivityModel
- `DELETE /api/activities/{id}` -> `ActivityController::api_delete_activity` -> ActivityModel
- `GET /api/activities/{id}/submissions` -> `ActivityController::api_get_submissions` -> ActivityModel
- `GET /api/activities/{id}/my-submission` -> `ActivityController::api_get_my_submission` -> ActivityModel
- `POST /api/activities/{id}/submit` -> `ActivityController::api_submit_activity` -> ActivityModel
- `POST /api/activities/{id}/grade` -> `ActivityController::api_save_grade` -> ActivityModel
- `GET /api/activities/{id}/grades` -> `ActivityController::api_get_activity_grades` -> ActivityModel
- `POST /api/activities/{id}/grades` -> `ActivityController::api_set_grade` -> ActivityModel
- `GET /api/activity-grades` -> `ActivityController::api_get_activity_grades_by_params` -> ActivityModel

- `POST /api/grading-inputs/sync-lms` -> `ActivityController::api_sync_grading_inputs_from_lms` -> ActivityModel
- `GET /api/grading-inputs` -> `ActivityController::api_get_grading_inputs` -> ActivityModel
- `POST /api/grading-inputs` -> `ActivityController::api_create_grading_input` -> ActivityModel
- `PUT /api/grading-inputs/{id}` -> `ActivityController::api_update_grading_input` -> ActivityModel
- `DELETE /api/grading-inputs/{id}` -> `ActivityController::api_delete_grading_input` -> ActivityModel
- `POST /api/grading-inputs/{id}/score` -> `ActivityController::api_set_grading_input_score` -> ActivityModel

- `GET /api/activities/{id}/questions` -> `QuizController::api_get_questions` -> Quiz_model
- `POST /api/activities/{id}/questions` -> `QuizController::api_create_question` -> Quiz_model
- `PUT /api/activities/{id}/questions/{questionId}` -> `QuizController::api_update_question` -> Quiz_model
- `DELETE /api/activities/{id}/questions/{questionId}` -> `QuizController::api_delete_question` -> Quiz_model
- `POST /api/activities/{id}/settings` -> `QuizController::api_save_settings` -> Quiz_model
- `GET /api/activities/{id}/settings` -> `QuizController::api_get_settings` -> Quiz_model
- `GET /api/activities/{id}/quiz/session` -> `QuizController::api_get_session` -> Quiz_model
- `GET /api/activities/{id}/quiz/start` -> `QuizController::api_start_quiz` -> Quiz_model
- `POST /api/activities/{id}/quiz/save-answer` -> `QuizController::api_save_answer` -> Quiz_model
- `POST /api/activities/{id}/quiz/submit` -> `QuizController::api_submit_quiz` -> Quiz_model
- `GET /api/activities/{id}/student-answers` -> `QuizController::api_get_student_answers` -> Quiz_model
- `POST /api/activities/{id}/grade-answer` -> `QuizController::api_grade_answer` -> Quiz_model

### File Uploads and Learning Materials
- `POST /api/upload/file` -> `UploadController::uploadFile` -> upload helpers
- `DELETE /api/upload/file` -> `UploadController::deleteFile` -> upload helpers

- `POST /api/learning-materials` -> `LearningMaterialsController::create` -> LearningMaterials_model
- `GET /api/learning-materials/subject/{id}` -> `LearningMaterialsController::getBySubject` -> LearningMaterials_model
- `GET /api/learning-materials/{id}` -> `LearningMaterialsController::getById` -> LearningMaterials_model
- `PUT /api/learning-materials/{id}` -> `LearningMaterialsController::update` -> LearningMaterials_model
- `DELETE /api/learning-materials/{id}` -> `LearningMaterialsController::delete` -> LearningMaterials_model

### Academic Periods
- `GET /api/academic-periods` -> `AcademicPeriodController::api_get_periods` -> AcademicPeriodModel
- `GET /api/academic-periods/stats` -> `AcademicPeriodController::api_get_stats` -> AcademicPeriodModel
- `GET /api/academic-periods/active` -> `AcademicPeriodController::api_get_active` -> AcademicPeriodModel
- `GET /api/academic-periods/active-public` -> `AcademicPeriodController::api_get_active_public` -> AcademicPeriodModel
- `GET /api/academic-periods/grading-context` -> `AcademicPeriodController::api_get_grading_context` -> AcademicPeriodModel
- `GET /api/academic-periods/current-subjects` -> `AcademicPeriodController::api_get_current_subjects` -> AcademicPeriodModel
- `GET /api/academic-periods/school-years` -> `AcademicPeriodController::api_get_school_years` -> AcademicPeriodModel
- `GET /api/academic-periods/{id}` -> `AcademicPeriodController::api_get_period` -> AcademicPeriodModel
- `POST /api/academic-periods` -> `AcademicPeriodController::api_create_period` -> AcademicPeriodModel
- `PUT /api/academic-periods/{id}` -> `AcademicPeriodController::api_update_period` -> AcademicPeriodModel
- `POST /api/academic-periods/{id}/set-active` -> `AcademicPeriodController::api_set_active` -> AcademicPeriodModel
- `DELETE /api/academic-periods/{id}` -> `AcademicPeriodController::api_delete_period` -> AcademicPeriodModel

### School Fees
- `GET /api/school-fees` -> `SchoolFeesController::api_get_fees` -> SchoolFeesModel
- `GET /api/school-fees/student/{student_id}` -> `SchoolFeesController::api_get_student_fees` -> SchoolFeesModel
- `GET /api/school-fees/{id}` -> `SchoolFeesController::api_get_fee` -> SchoolFeesModel
- `POST /api/school-fees` -> `SchoolFeesController::api_create_fee` -> SchoolFeesModel
- `PUT /api/school-fees/{id}` -> `SchoolFeesController::api_update_fee` -> SchoolFeesModel
- `PUT /api/school-fees/{id}/toggle-status` -> `SchoolFeesController::api_toggle_status` -> SchoolFeesModel
- `DELETE /api/school-fees/{id}` -> `SchoolFeesController::api_delete_fee` -> SchoolFeesModel

### RFID Attendance
- `GET /api/rfid/sessions` -> `RFIDController::api_sessions` -> RFIDSessionModel
- `POST /api/rfid/sessions` -> `RFIDController::api_create_session` -> RFIDSessionModel
- `POST /api/rfid/sessions/{id}/start` -> `RFIDController::api_start_session` -> RFIDSessionModel
- `POST /api/rfid/sessions/{id}/end` -> `RFIDController::api_end_session` -> RFIDSessionModel
- `GET /api/rfid/scans` -> `RFIDController::api_scans` -> RFIDScanModel
- `POST /api/rfid/scans` -> `RFIDController::api_create_scan` -> RFIDScanModel
- `POST /api/rfid/verify-passkey` -> `RFIDController::api_verify_passkey` -> RFIDScanModel

### Tuition Packages
- `GET /api/tuition-packages` -> `TuitionPackagesController::api_get_packages` -> TuitionPackagesModel
- `GET /api/tuition-packages/active` -> `TuitionPackagesController::api_get_active` -> TuitionPackagesModel
- `POST /api/tuition-packages` -> `TuitionPackagesController::api_create_package` -> TuitionPackagesModel
- `PUT /api/tuition-packages/{id}` -> `TuitionPackagesController::api_update_package` -> TuitionPackagesModel
- `DELETE /api/tuition-packages/{id}` -> `TuitionPackagesController::api_delete_package` -> TuitionPackagesModel

### Uniforms
- `GET /api/uniform-items` -> `UniformItemsController::api_get_items` -> UniformItemsModel
- `GET /api/uniform-items/{id}` -> `UniformItemsController::api_get_item` -> UniformItemsModel
- `POST /api/uniform-items` -> `UniformItemsController::api_create_item` -> UniformItemsModel
- `PUT /api/uniform-items/{id}` -> `UniformItemsController::api_update_item` -> UniformItemsModel
- `PUT /api/uniform-items/{id}/toggle` -> `UniformItemsController::api_toggle_item` -> UniformItemsModel
- `DELETE /api/uniform-items/{id}` -> `UniformItemsController::api_delete_item` -> UniformItemsModel

- `GET /api/uniform-orders` -> `UniformOrdersController::api_get_orders` -> UniformOrdersModel (not listed, check implementation)
- `POST /api/uniform-orders` -> `UniformOrdersController::api_create_order` -> UniformOrdersModel (not listed, check implementation)
- `POST /api/uniform-orders/batch` -> `UniformOrdersController::api_create_order_batch` -> UniformOrdersModel (not listed, check implementation)

### School Services (Monthly Fees)
- `GET /api/school-services/service-fee-amount` -> `SchoolServiceController::get_service_fee_amount` -> SchoolFeesModel
- `GET /api/school-services/payments` -> `SchoolServiceController::get_service_payments` -> PaymentModel
- `GET /api/school-services/students` -> `SchoolServiceController::get_students` -> StudentModel
- `GET /api/school-services/monthly-summary` -> `SchoolServiceController::get_monthly_summary` -> PaymentModel
- `POST /api/school-services/create-payment` -> `SchoolServiceController::create_service_payment` -> PaymentModel

### Payments, Discounts, and Plans
- `GET /api/payments/check-reference` -> `PaymentController::check_reference` -> PaymentModel
- `GET /api/payments/check-service-period` -> `PaymentController::check_service_period` -> PaymentModel
- `GET /api/payments/by-enrollment` -> `PaymentController::by_enrollment` -> PaymentModel
- `GET /api/payments/applicable-discounts` -> `PaymentController::get_applicable_discounts` -> PaymentDiscountModel
- `GET /api/payments` -> `PaymentController::get_payments` -> PaymentModel
- `GET /api/payments/student/{student_id}` -> `PaymentController::get_payments_by_student` -> PaymentModel
- `GET /api/payments/{id}` -> `PaymentController::get_payment` -> PaymentModel
- `GET /api/payments/{id}/discounts` -> `PaymentController::get_payment_discounts` -> PaymentDiscountApplicationModel
- `POST /api/payments` -> `PaymentController::create_payment` -> PaymentModel
- `POST /api/payments/{id}/discounts` -> `PaymentController::apply_discount` -> PaymentDiscountApplicationModel
- `POST /api/payments/{id}/refund` -> `PaymentController::create_refund` -> PaymentModel
- `PUT /api/payments/{id}` -> `PaymentController::update_payment` -> PaymentModel
- `PUT /api/payments/{id}/recalculate` -> `PaymentController::recalculate_totals` -> PaymentModel
- `DELETE /api/payments/{id}` -> `PaymentController::delete_payment` -> PaymentModel
- `DELETE /api/payments/{payment_id}/discounts/{discount_id}` -> `PaymentController::remove_discount` -> PaymentDiscountApplicationModel
- `POST /api/payments/{id}/mark-notifications-read` -> `PaymentController::mark_payment_notifications_as_read` -> NotificationService
- `POST /api/payments/{id}/upload-proof` -> `PaymentController::upload_proof` -> PaymentModel
- `DELETE /api/payments/{id}/delete-proof` -> `PaymentController::delete_proof` -> PaymentModel
- `GET /api/payments/{id}/proof-info` -> `PaymentController::get_proof_info` -> PaymentModel

- `GET /api/payment-installment-penalties` -> `PaymentController::get_all_penalties` -> PaymentPenaltyModel
- `GET /api/payment-penalties/{id}` -> `PaymentPenaltyController::get_by_id` -> PaymentPenaltyModel
- `GET /api/payment-penalties/installment/{installment_id}` -> `PaymentPenaltyController::get_by_installment` -> PaymentPenaltyModel
- `GET /api/payment-penalties/student/{student_id}` -> `PaymentPenaltyController::get_by_student` -> PaymentPenaltyModel
- `POST /api/payment-penalties/record` -> `PaymentPenaltyController::record_penalty` -> PaymentPenaltyModel
- `POST /api/payment-penalties/submit-explanation` -> `PaymentPenaltyController::submit_explanation` -> LatePaymentExplanationModel
- `POST /api/payment-penalties/request-waiver` -> `PaymentPenaltyController::submit_explanation` -> LatePaymentExplanationModel
- `GET /api/payment-penalties/waiver-requests` -> `PaymentPenaltyController::get_student_explanations` -> LatePaymentExplanationModel

- `POST /api/gcash-sessions` -> `GcashUploadSessionController::create_session` -> GcashUploadSessionModel
- `GET /api/gcash-sessions/{token}/status` -> `GcashUploadSessionController::session_status` -> GcashUploadSessionModel
- `PUT /api/gcash-sessions/{token}/viewed` -> `GcashUploadSessionController::mark_viewed` -> GcashUploadSessionModel
- `GET /api/gcash-sessions/{token}/info` -> `GcashUploadSessionController::session_info` -> GcashUploadSessionModel
- `POST /api/gcash-sessions/{token}/upload` -> `GcashUploadSessionController::upload_proof` -> GcashUploadSessionModel

- `GET /api/admin/discount-templates` -> `DiscountController::api_discount_templates_get` -> Discount_model
- `POST /api/admin/discount-templates` -> `DiscountController::api_discount_templates_create` -> Discount_model
- `PUT /api/admin/discount-templates/{id}` -> `DiscountController::api_discount_templates_update` -> Discount_model
- `DELETE /api/admin/discount-templates/{id}` -> `DiscountController::api_discount_templates_delete` -> Discount_model
- `PUT /api/admin/discount-templates/{id}/toggle` -> `DiscountController::api_discount_templates_toggle` -> Discount_model

- `GET /api/payment-discounts` -> `PaymentDiscountController::get_discounts` -> PaymentDiscountModel
- `GET /api/payment-discounts/student/{student_id}/period/{period_id}` -> `PaymentDiscountController::get_student_discounts` -> PaymentDiscountModel
- `POST /api/payment-discounts` -> `PaymentDiscountController::create_discount` -> PaymentDiscountModel

- `GET /api/payment-plans` -> `PaymentPlanController::get_plans` -> PaymentPlanModel
- `GET /api/payment-plans/installments/all` -> `PaymentPlanController::get_all_installments` -> InstallmentModel
- `GET /api/payment-plans/{id}` -> `PaymentPlanController::get_plan` -> PaymentPlanModel
- `GET /api/payment-plans/{id}/installments` -> `PaymentPlanController::get_installments` -> InstallmentModel
- `POST /api/payment-plans/{id}/mark-notifications-read` -> `PaymentPlanController::mark_plan_notifications_as_read` -> NotificationService
- `POST /api/payment-plans` -> `PaymentPlanController::create_plan` -> PaymentPlanModel
- `PUT /api/payment-plans/{id}` -> `PaymentPlanController::update_plan` -> PaymentPlanModel
- `PUT /api/payment-plans/{id}/set-enrollment-date` -> `PaymentPlanController::set_enrollment_date` -> PaymentPlanModel
- `PUT /api/payment-plans/installments/{id}` -> `PaymentPlanController::update_installment` -> InstallmentModel
- `DELETE /api/payment-plans/{id}` -> `PaymentPlanController::delete_plan` -> PaymentPlanModel

- `GET /api/payment-schedule-templates` -> `PaymentScheduleTemplateController::get_templates` -> PaymentScheduleTemplateModel
- `GET /api/payment-schedule-templates/{id}` -> `PaymentScheduleTemplateController::get_template` -> PaymentScheduleTemplateModel
- `POST /api/payment-schedule-templates` -> `PaymentScheduleTemplateController::create_template` -> PaymentScheduleTemplateModel
- `PUT /api/payment-schedule-templates/{id}` -> `PaymentScheduleTemplateController::update_template` -> PaymentScheduleTemplateModel
- `PUT /api/payment-schedule-templates/{id}/toggle-status` -> `PaymentScheduleTemplateController::toggle_status` -> PaymentScheduleTemplateModel
- `DELETE /api/payment-schedule-templates/{id}` -> `PaymentScheduleTemplateController::delete_template` -> PaymentScheduleTemplateModel

### Enrollment Periods and Documents
- `GET /api/enrollment-periods` -> `EnrollmentPeriodController::api_enrollment_periods` -> EnrollmentModel
- `GET /api/enrollment-periods/active` -> `EnrollmentPeriodController::api_enrollment_period_active` -> EnrollmentModel
- `GET /api/enrollment-periods/{id}` -> `EnrollmentPeriodController::api_enrollment_period_by_id` -> EnrollmentModel
- `POST /api/enrollment-periods` -> `EnrollmentPeriodController::api_enrollment_period_create` -> EnrollmentModel
- `PUT /api/enrollment-periods/{id}` -> `EnrollmentPeriodController::api_enrollment_period_update` -> EnrollmentModel
- `POST /api/enrollment-periods/{id}/set-active` -> `EnrollmentPeriodController::api_enrollment_period_set_active` -> EnrollmentModel
- `DELETE /api/enrollment-periods/{id}` -> `EnrollmentPeriodController::api_enrollment_period_delete` -> EnrollmentModel

- `GET /api/admin/document-requirements` -> `DocumentRequirementController::api_get_all` -> DocumentRequirement_model
- `GET /api/admin/document-catalog` -> `DocumentRequirementController::api_get_catalog` -> DocumentRequirement_model
- `POST /api/admin/document-catalog` -> `DocumentRequirementController::api_create_catalog` -> DocumentRequirement_model
- `PUT /api/admin/document-catalog/{id}` -> `DocumentRequirementController::api_update_catalog` -> DocumentRequirement_model
- `PATCH /api/admin/document-catalog/{id}/toggle` -> `DocumentRequirementController::api_toggle_catalog` -> DocumentRequirement_model
- `GET /api/document-requirements-enrollment/{gradeLevel}/{enrollmentType?}` -> `DocumentRequirementController::api_get_for_enrollment` -> DocumentRequirement_model
- `GET /api/document-requirements/{gradeLevel}/{enrollmentType?}` -> `DocumentRequirementController::api_get_by_criteria` -> DocumentRequirement_model
- `POST /api/admin/document-requirements` -> `DocumentRequirementController::api_create` -> DocumentRequirement_model
- `PUT /api/admin/document-requirements/{id}` -> `DocumentRequirementController::api_update` -> DocumentRequirement_model
- `DELETE /api/admin/document-requirements/{id}` -> `DocumentRequirementController::api_delete` -> DocumentRequirement_model
- `PATCH /api/admin/document-requirements/{id}/toggle` -> `DocumentRequirementController::api_toggle_active` -> DocumentRequirement_model

### Announcements
- `GET /api/announcements` -> `AnnouncementController::api_get_announcements` -> AnnouncementModel
- `GET /api/announcements/{id}` -> `AnnouncementController::api_get_announcement` -> AnnouncementModel
- `POST /api/announcements` -> `AnnouncementController::api_create_announcement` -> AnnouncementModel
- `PUT /api/announcements/{id}` -> `AnnouncementController::api_update_announcement` -> AnnouncementModel
- `DELETE /api/announcements/{id}` -> `AnnouncementController::api_delete_announcement` -> AnnouncementModel
- `POST /api/announcements/{id}/mark-as-read` -> `AnnouncementController::api_mark_announcement_as_read` -> AnnouncementModel

### Feedback and Concerns
- `GET /api/feedback` -> `FeedbackController::api_get_feedback` -> FeedbackModel
- `GET /api/feedback/my` -> `FeedbackController::api_get_my_feedback` -> FeedbackModel
- `POST /api/feedback` -> `FeedbackController::api_create_feedback` -> FeedbackModel
- `PUT /api/feedback/{id}/sentiment` -> `FeedbackController::api_update_sentiment` -> FeedbackModel
- `PUT /api/feedback/{id}/response` -> `FeedbackController::api_update_response` -> FeedbackModel

- `GET /api/concerns` -> `ConcernController::api_get_concerns` -> ConcernModel
- `GET /api/concerns/my` -> `ConcernController::api_get_my_concerns` -> ConcernModel
- `POST /api/concerns` -> `ConcernController::api_create_concern` -> ConcernModel
- `GET /api/concerns/{id}/messages` -> `ConcernController::api_get_concern_messages` -> MessageModel
- `POST /api/concerns/{id}/messages` -> `ConcernController::api_add_concern_message` -> MessageModel
- `PUT /api/concerns/{id}/status` -> `ConcernController::api_update_concern_status` -> ConcernModel

### Sentiment Proxy
- `GET /api/sentiment/health` -> `SentimentController::api_health` -> external/local ML
- `POST /api/sentiment/predict` -> `SentimentController::api_predict` -> external/local ML
- `POST /api/sentiment/predict/batch` -> `SentimentController::api_predict_batch` -> external/local ML
- `POST /api/insights/weekly` -> `SentimentController::api_weekly_insights` -> WeeklyInsightsModel

### Chatbot
- `GET /api/admin/chatbot-knowledge` -> `ChatbotController::api_get_knowledge` -> ChatbotKnowledgeModel
- `POST /api/admin/chatbot-knowledge` -> `ChatbotController::api_create_knowledge` -> ChatbotKnowledgeModel
- `PUT /api/admin/chatbot-knowledge/{id}` -> `ChatbotController::api_update_knowledge` -> ChatbotKnowledgeModel
- `DELETE /api/admin/chatbot-knowledge/{id}` -> `ChatbotController::api_delete_knowledge` -> ChatbotKnowledgeModel
- `PUT /api/admin/chatbot-knowledge/{id}/toggle` -> `ChatbotController::api_toggle_knowledge` -> ChatbotKnowledgeModel
- `POST /api/chatbot/message` -> `ChatbotController::api_chat` -> ChatbotConversationModel

### Campuses
- `GET /api/campuses` -> `CampusController::api_get_campuses` -> CampusModel
- `GET /api/campuses/{id}` -> `CampusController::api_get_campus` -> CampusModel
- `POST /api/campuses` -> `CampusController::api_create_campus` -> CampusModel
- `PUT /api/campuses/{id}` -> `CampusController::api_update_campus` -> CampusModel
- `DELETE /api/campuses/{id}` -> `CampusController::api_delete_campus` -> CampusModel

### Attendance
- `POST /api/attendance/mark` -> `AttendanceController::api_mark_attendance` -> AttendanceModel
- `POST /api/attendance/bulk` -> `AttendanceController::api_bulk_insert_attendance` -> AttendanceModel
- `POST /api/attendance/sessions` -> `AttendanceController::api_create_session` -> AttendanceModel
- `GET /api/attendance/teacher/{teacher_id}/sessions` -> `AttendanceController::api_get_teacher_sessions` -> AttendanceModel
- `GET /api/attendance/sessions/{session_id}` -> `AttendanceController::api_get_session_attendance` -> AttendanceModel
- `PUT /api/attendance/session/{session_id}/student/{student_id}` -> `AttendanceController::api_update_session_attendance` -> AttendanceModel
- `GET /api/attendance/student/{student_id}` -> `AttendanceController::api_get_student_attendance` -> AttendanceModel
- `GET /api/attendance/course/{course_id}` -> `AttendanceController::api_get_course_attendance` -> AttendanceModel
- `GET /api/attendance/today` -> `AttendanceController::api_get_today_attendance` -> AttendanceModel

### Reports and Final Grades
- `GET /api/reports/students` -> `ReportController::api_get_students` -> StudentModel
- `GET /api/reports/student/{student_id}/pdf` -> `ReportController::api_generate_student_report` -> StudentModel, FinalGradesModel
- `GET /api/reports/debug/student/{student_id}/grades` -> `ReportController::api_debug_student_grades` -> FinalGradesModel
- `POST /api/reports/bulk/pdf` -> `ReportController::api_generate_bulk_reports` -> StudentModel, FinalGradesModel

- `POST /api/final-grades/submit` -> `FinalGradesController::api_submit_grades` -> FinalGradesModel
- `GET /api/final-grades` -> `FinalGradesController::api_get_final_grades` -> FinalGradesModel
- `GET /api/final-grades/submission-control` -> `FinalGradesController::api_get_submission_control` -> FinalGradesModel
- `PUT /api/final-grades/submission-control` -> `FinalGradesController::api_update_submission_control` -> FinalGradesModel

### Messages and Broadcasts
- `GET /api/messages` -> `MessageController::api_get_inbox` -> MessageModel
- `POST /api/messages` -> `MessageController::api_send_message` -> MessageModel
- `GET /api/messages/{id}` -> `MessageController::api_get_message` -> MessageModel
- `PUT /api/messages/{id}/read` -> `MessageController::api_mark_as_read` -> MessageModel
- `GET /api/messages/conversation/{user_id}` -> `MessageController::api_get_conversation` -> MessageModel
- `DELETE /api/messages/{id}` -> `MessageController::api_delete_message` -> MessageModel

- `GET /api/broadcasts/my` -> `BroadcastController::api_get_my_broadcasts` -> BroadcastModel
- `POST /api/broadcasts` -> `BroadcastController::api_create_broadcast` -> BroadcastModel
- `GET /api/broadcasts/{id}` -> `BroadcastController::api_get_broadcast` -> BroadcastModel
- `GET /api/broadcasts/subject/{subject_id}` -> `BroadcastController::api_get_broadcasts_by_subject` -> BroadcastModel
- `GET /api/broadcasts/section/{section_id}` -> `BroadcastController::api_get_broadcasts_by_section` -> BroadcastModel
- `DELETE /api/broadcasts/{id}` -> `BroadcastController::api_delete_broadcast` -> BroadcastModel

### Enrollments
- `POST /api/enrollments/classify-student` -> `EnrollmentClassificationController::api_classify_student` -> EnrollmentModel
- `POST /api/enrollments/submit` -> `EnrollmentController::api_submit_enrollment` -> EnrollmentModel
- `GET /api/enrollments/stats` -> `EnrollmentController::api_get_enrollment_stats` -> EnrollmentModel
- `GET /api/enrollments/latest` -> `EnrollmentController::api_get_latest_enrollment` -> EnrollmentModel
- `GET /api/enrollments/{id}/status` -> `EnrollmentController::api_get_enrollment_status` -> EnrollmentModel
- `GET /api/enrollments/{id}/payments` -> `EnrollmentController::api_get_enrollment_payments` -> PaymentModel
- `GET /api/enrollments/{id}/preview-for-continuing` -> `EnrollmentController::api_get_enrollment_preview_for_continuing` -> EnrollmentModel
- `PUT /api/enrollments/{enrollment_id}/discounts/{discount_id}` -> `EnrollmentController::api_update_enrollment_discount` -> PaymentDiscountModel
- `GET /api/enrollments/{id}/discounts` -> `EnrollmentController::api_get_enrollment_discounts` -> PaymentDiscountModel
- `POST /api/enrollments/{id}/discounts` -> `EnrollmentController::api_create_enrollment_discount` -> PaymentDiscountModel
- `GET /api/enrollments/{id}` -> `EnrollmentController::api_get_enrollment` -> EnrollmentModel
- `GET /api/enrollments` -> `EnrollmentController::api_get_enrollments` -> EnrollmentModel
- `PUT /api/enrollments/{id}/status` -> `EnrollmentController::api_update_enrollment_status` -> EnrollmentModel
- `POST /api/enrollments/auto-create-continuing` -> `EnrollmentController::api_auto_create_continuing` -> EnrollmentModel
- `GET /api/students/current-grade` -> `EnrollmentController::api_get_current_grade` -> EnrollmentModel

- `GET /api/adviser/enrollments/eligible-students` -> `EnrollmentAdminController::api_adviser_eligible_students` -> EnrollmentModel
- `POST /api/adviser/enrollments/submit` -> `EnrollmentAdminController::api_adviser_submit_enrollment` -> EnrollmentModel
- `GET /api/adviser/enrollments/{id}/payments` -> `EnrollmentAdminController::api_adviser_enrollment_payments` -> PaymentModel

- `GET /api/admin/enrollments/stats` -> `EnrollmentAdminController::api_admin_enrollments_stats` -> EnrollmentModel
- `GET /api/admin/enrollments/{id}` -> `EnrollmentAdminController::api_admin_enrollment_detail` -> EnrollmentModel
- `POST /api/admin/enrollments/{id}/approve` -> `EnrollmentAdminController::api_admin_enrollment_approve` -> EnrollmentModel
- `POST /api/admin/enrollments/{id}/reject` -> `EnrollmentAdminController::api_admin_enrollment_reject` -> EnrollmentModel
- `POST /api/admin/documents/{id}/verify` -> `EnrollmentAdminController::api_admin_document_verify` -> DocumentRequirement_model
- `POST /api/admin/documents/toggle-manual` -> `EnrollmentAdminController::api_admin_document_toggle_manual` -> DocumentRequirement_model
- `POST /api/admin/documents/{id}/reject` -> `EnrollmentAdminController::api_admin_document_reject` -> DocumentRequirement_model
- `GET /api/admin/enrollments` -> `EnrollmentAdminController::api_admin_enrollments` -> EnrollmentModel
- `GET /api/adviser/enrollments` -> `EnrollmentAdminController::api_adviser_enrollments` -> EnrollmentModel

### Misc and Utilities
- `GET /tools/generate-students` -> `Tools::generate_students`

## Key Constraints and Safety Notes
- Transaction safety and idempotency for payments/enrollments is documented in [LavaLust/TRANSACTION_SAFETY_GUIDE.md](LavaLust/TRANSACTION_SAFETY_GUIDE.md).
- Proof of payment uploads and related endpoints are documented in [LavaLust/PROOF_OF_PAYMENT_README.md](LavaLust/PROOF_OF_PAYMENT_README.md).
- Notification templates and types are documented in [LavaLust/NOTIFICATION_TEMPLATES.md](LavaLust/NOTIFICATION_TEMPLATES.md).
