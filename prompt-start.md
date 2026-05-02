Step 1 only: Inspect and understand the project structure. Do not edit any files yet.

This project has two main folders:
- EduTrackUI = frontend
- LavaLust = backend/API

Important:
The frontend and backend are separate. Do not treat them as one framework.
The frontend should communicate with the backend only through API endpoint constants and API helper functions.
Do not assume direct imports between EduTrackUI and LavaLust.

Backend framework warning:
The backend uses LavaLust, not Laravel.
LavaLust is less common and has its own structure and conventions.
Do not assume Laravel-style routing, middleware, Eloquent models, migrations, Request classes, Artisan commands, or Laravel helper functions.
Before suggesting or making backend changes, study how this specific project already does routes, controllers, models, database queries, auth/session handling, and JSON responses.

Please inspect these areas first:
1. Where frontend API endpoints are defined.
2. How frontend API helpers work, such as apiGet, apiPost, apiPut, apiDelete, or similar.
3. How authentication/session/token is sent from frontend to backend.
4. How frontend pages call backend APIs.
5. How backend API routes are defined in LavaLust.
6. How LavaLust controllers receive request data.
7. How LavaLust controllers return JSON success/error responses.
8. How LavaLust models perform database select, insert, update, delete, and join queries.
9. How the backend identifies the logged-in user, especially teacher/student/admin.
10. How timestamps and request payloads are formatted.

Use existing project files as references, especially:
- EduTrackUI/src
- EduTrackUI/src/lib or utils folders
- EduTrackUI/src/config or API endpoint files
- LavaLust/app/controllers
- LavaLust/app/models
- LavaLust/app/config/routes.php or any route file used by this project
- Existing controllers such as AnnouncementController.php, TeacherController.php, StudentController.php, BroadcastController.php, UserController.php
- Existing models such as AnnouncementModel.php and teacher/student-related models

Required output before editing:
Explain the actual connection flow in this project:

Frontend page/component
→ API endpoint constant
→ API helper/request function
→ backend LavaLust route
→ controller method
→ model/database query
→ JSON response
→ frontend state/UI update

Also explain:
- Which files control frontend API calls.
- Which files control backend routes.
- Which controller/model pattern this LavaLust backend follows.
- How authentication/user role is currently detected.
- Any important conventions I should follow before asking you to edit features.

Do not modify files in this step.
Only inspect and explain the structure and connection flow.