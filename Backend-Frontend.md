Here is what I found from inspecting the current codebase (no edits made). I am treating EduTrackUI and LavaLust as separate apps, connected only via HTTP.

Connection Flow (example: announcements in teacher dashboard)
Frontend page/component
→ API endpoint constant
→ API helper/request function
→ backend route
→ controller method
→ model/db query
→ JSON response
→ frontend state/UI update

Concrete example in this project:

TeacherDashboard.tsx calls apiGet for API_ENDPOINTS.ANNOUNCEMENTS.
Endpoints and helpers are defined in api.ts.
Route is defined in routes.php: /api/announcements → AnnouncementController::api_get_announcements.
Controller implementation in AnnouncementController.php checks session and returns JSON.
Data query in AnnouncementModel.php uses query builder and raw SQL to fetch announcements and read status.
JSON result is returned and used to update notifications/UI state in the dashboard.
Where frontend API endpoints are defined

Central registry of endpoints is API_ENDPOINTS in api.ts.
Base URL comes from VITE_API_BASE_URL with dev proxy fallback and localhost safety logic in the same file.
How frontend API helpers work

apiGet, apiPost, apiPut, apiDelete, and apiUploadFile are defined in api.ts.
All helper calls include credentials: 'include' to send cookies (session auth).
Helpers expect JSON responses; they parse response text and throw on non-OK.
How authentication/session/token is sent from frontend to backend

Primary mechanism: cookie-based sessions (credentials: 'include') in api.ts.
Auth state is managed by useAuth using /api/auth/check and /api/auth/login in useAuth.tsx.
There are exceptions where direct fetch is used and an Authorization: Bearer ... header is set (legacy/isolated usage), e.g. EnrolleeDashboard.tsx. I did not find a centralized token issue flow in the standard helpers, so this looks inconsistent with the cookie-based auth approach.
How frontend pages call backend APIs

Most pages import API_ENDPOINTS and apiGet/apiPost from api.ts. Example in TeacherDashboard.tsx.
Some components bypass helpers and call fetch('/api/...') directly (admin discount flow) in DiscountDialog.tsx.
How backend API routes are defined in LavaLust

All routes are declared in routes.php using $router->get, $router->post, $router->put, $router->delete, and $router->match.
Routes map to Controller::method strings, e.g. AnnouncementController::api_get_announcements.
How LavaLust controllers receive request data

For JSON endpoints, controllers commonly use file_get_contents('php://input') and json_decode (see UserController.php, AnnouncementController.php).
Some endpoints also read form posts via $this->io->post() (in UserController).
How LavaLust controllers return JSON success/error responses

Most controllers call api_set_json_headers() and then use http_response_code(...) + echo json_encode(...) directly (see AnnouncementController.php, UserController.php).
Shared helper for CORS/JSON headers is in api_helper.php, with optional api_json_response() and api_error() helpers (not always used).
How LavaLust models perform DB queries

Models use LavaLust’s query builder via $this->db->table(...)->select(...)->where(...)->join(...)->get()/get_all() (see TeacherModel.php, StudentModel.php).
Raw SQL is used for complex joins or search (see AnnouncementModel.php, StudentModel.php).
Timestamps are written via app_now() (see datetime_helper.php).
How the backend identifies the logged-in user

Session-based auth: UserController::api_login sets session data (user_id, role, logged_in) in UserController.php.
Controllers check session->userdata('logged_in') and session->userdata('role') to authorize (see AnnouncementController.php, StudentController.php, TeacherController.php).
How timestamps and request payloads are formatted

Timestamps: app_now() returns Y-m-d H:i:s in datetime_helper.php.
Request payloads: typically JSON body for API calls; file upload uses multipart/FormData (see apiUploadFile in api.ts).
Files that control frontend API calls

api.ts — endpoint constants, API helpers, base URL handling.
useAuth.tsx — login, session check, logout.
Components/pages consume the helpers, e.g. TeacherDashboard.tsx.
Exceptions using direct fetch: DiscountDialog.tsx and EnrolleeDashboard.tsx.
Files that control backend routes

routes.php is the single routing registry.
Controller/model pattern in LavaLust

Controllers extend LavaLust Controller, call $this->call->model(...) and $this->call->database(), and use $this->db for queries or model methods (see UserController.php, AnnouncementController.php).
Models extend LavaLust Model and encapsulate DB access via the query builder or raw SQL (see AnnouncementModel.php, TeacherModel.php, StudentModel.php).
Authentication/user role detection

Frontend: session check via /api/auth/check in useAuth.tsx.
Backend: session values user_id, role, and logged_in stored on login in UserController.php, then read in controllers.
Important conventions to follow before edits

Use API_ENDPOINTS + apiGet/apiPost/apiPut/apiDelete in api.ts for frontend API calls, unless there is a specific reason to bypass helpers.
Session auth is cookie-based (credentials: 'include'); avoid introducing token-only flows unless the backend is explicitly expecting them.
Keep LavaLust routing centralized in routes.php.
Controllers should call api_set_json_headers() and return JSON with success + message + data patterns, consistent with existing controllers.
Use app_now() for timestamps in models for DB consistency.
If you want, I can map additional flows (e.g., activities/grades, payments, enrollments) or inspect specific controllers/models next.