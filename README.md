# StudySpace

StudySpace is a full-stack student task manager for organizing schoolwork in one friendly, responsive interface. Students create an account, sign in, and manage a private task list with titles, descriptions, priorities, and due dates.

The browser interface is served by the same application as the API. Task data is stored in a database, not in browser storage.

## Features

- Create a student account, sign in, and sign out.
- Create, view, edit, and delete tasks.
- Set a task title, optional description, priority, and optional due date.
- Keep each student's tasks private to their account.
- Keep a signed-in session when the page is reloaded.
- Search tasks by title or description and filter by priority or due date.
- Use the built-in 25-minute focus and 5-minute break timer.
- View a responsive, accessible HTML interface with labelled forms and status messages.
- Explore and try the API through the automatically generated Swagger UI.

## Technology

| Part | Technology |
| --- | --- |
| Frontend | HTML, CSS, and vanilla JavaScript |
| Backend and API | Python 3.12+, FastAPI, and Uvicorn |
| Database access | SQLAlchemy 2 |
| Local database | SQLite |
| Containerized database | PostgreSQL 16 |
| Validation | Pydantic |
| Authentication | Argon2 password hashes and signed JWT session cookies |
| Automated tests | pytest and FastAPI TestClient |

There is no JavaScript framework or frontend build step. FastAPI serves the files in `static/` and the API from the same origin.

## Project structure

```text
.
├── app/
│   ├── __init__.py
│   └── main.py             # Database models, validation, and HTTP API
├── static/
│   ├── index.html          # Student account and task interface
│   ├── script.js           # API requests and page interactions
│   └── styles.css          # Responsive interface styles
├── tests/
│   ├── conftest.py         # Isolated test database
│   └── test_api.py         # Account and task API tests
├── .env.example            # Docker Compose configuration template
├── compose.yaml            # PostgreSQL and application services
├── Dockerfile
├── requirements.txt
└── requirements-dev.txt
```

## Run locally with SQLite

SQLite is the default for a simple local development setup; no separate database server is needed. From the project root, open PowerShell and run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

$env:DATABASE_URL = "sqlite:///./studyspace.db"
$env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(32))")
$env:COOKIE_SECURE = "false"
python -m uvicorn app.main:app --reload
```

If PowerShell blocks virtual-environment activation, run the environment's Python directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) and create an account. The SQLite database file `studyspace.db` is created in the project directory the first time the app starts; keep it private and do not commit it.

Useful local URLs:

- Application: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- API health: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- Interactive API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative API reference: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

To stop a locally running server, press **Ctrl+C** in its terminal.

## Run with PostgreSQL using Docker Compose

Install and start Docker Desktop, then use PowerShell from the project root:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace `POSTGRES_PASSWORD` and `SECRET_KEY` with unique, long, URL-safe secrets. To generate a secret:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Use one generated value for `SECRET_KEY` and another for `POSTGRES_PASSWORD`. Then start the app:

```powershell
docker compose up --build
```

The Compose file starts PostgreSQL 16 and the application. It waits for PostgreSQL's health check before starting the application. Persistent database data lives in the `postgres_data` Docker volume. The default app address is [http://localhost:8000](http://localhost:8000).

Stop the services with **Ctrl+C**, or run `docker compose down` in another terminal. `docker compose down` keeps the database volume. To permanently remove the local Compose database and its data, run `docker compose down --volumes`.

For production, serve the app behind HTTPS and set `COOKIE_SECURE=true` in `.env`. Do not reuse the example secrets, publish your `.env` file, or expose an unencrypted production site.

### Run locally against an existing PostgreSQL server

Install the project dependencies, create an empty database and user, and set a SQLAlchemy PostgreSQL URL before starting the app:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://studyspace:YOUR_URL_SAFE_PASSWORD@localhost:5432/studyspace"
$env:SECRET_KEY = "YOUR_UNIQUE_URL_SAFE_SECRET"
python -m uvicorn app.main:app --reload
```

## Authentication and security behavior

- Registration and login set the `studyspace_session` cookie. It is HTTP-only, uses `SameSite=Lax`, and lasts seven days.
- Set `COOKIE_SECURE=true` when requests are served over HTTPS. Leave it `false` only for local HTTP development.
- Passwords are stored as Argon2 hashes; the API never returns a password or password hash.
- All task queries are scoped to the signed-in student's account. Trying to access another student's task returns `404`.
- All state-changing `/api/` requests (`POST`, `PUT`, `PATCH`, and `DELETE`) must include `X-Requested-With: StudySpace`, which the app's own frontend supplies.
- In production, set `ENVIRONMENT=production` and provide a unique `SECRET_KEY`; the built-in placeholder key is rejected in production.
- Changing `SECRET_KEY` invalidates existing signed-in sessions.

## API reference

All request and response bodies use JSON unless otherwise noted. Requests that change server data must include:

```http
X-Requested-With: StudySpace
```

Protected endpoints require the `studyspace_session` cookie obtained from registration or login. When trying the endpoints in Swagger UI, first call register or login so the browser receives the session cookie.

| Method | Endpoint | Login required | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Check API and database connectivity. |
| `POST` | `/api/auth/register` | No | Create an account and sign in. |
| `POST` | `/api/auth/login` | No | Sign in with an existing account. |
| `POST` | `/api/auth/logout` | No | Clear the session cookie. |
| `GET` | `/api/auth/me` | Yes | Get the current signed-in student's profile. |
| `GET` | `/api/tasks` | Yes | List the current student's tasks, newest first. |
| `POST` | `/api/tasks` | Yes | Create a task. |
| `PATCH` | `/api/tasks/{task_id}` | Yes | Update one or more task fields. |
| `DELETE` | `/api/tasks/{task_id}` | Yes | Delete a task. |

`PUT` is not implemented. `PATCH` is the supported partial-update method.

### Account request examples

Create an account:

```http
POST /api/auth/register
Content-Type: application/json
X-Requested-With: StudySpace

{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "a-long-unique-password"
}
```

Sign in:

```http
POST /api/auth/login
Content-Type: application/json
X-Requested-With: StudySpace

{
  "email": "alex@example.com",
  "password": "a-long-unique-password"
}
```

Successful registration and login return a student profile and set the HTTP-only session cookie:

```json
{
  "id": "56df5b09-71b6-4af1-9a83-a02c987c1d13",
  "name": "Alex Morgan",
  "email": "alex@example.com"
}
```

Sign out with `POST /api/auth/logout` and the `X-Requested-With` header. A successful logout returns `204 No Content`.

### Task example

Create a task with `POST /api/tasks`:

```json
{
  "title": "Read chapter four",
  "description": "Take notes on the key ideas.",
  "priority": "high",
  "due_date": "2026-11-05"
}
```

`priority` may be `low`, `medium`, or `high`. It defaults to `medium`; `description` defaults to an empty string; and `due_date` can be omitted or set to `null`.

Example response:

```json
{
  "id": "72d043bf-8aaf-4121-921b-9dd41e4e2fb5",
  "title": "Read chapter four",
  "description": "Take notes on the key ideas.",
  "priority": "high",
  "due_date": "2026-11-05",
  "created_at": "2026-10-23T09:00:00"
}
```

Edit selected fields with `PATCH /api/tasks/{task_id}`:

```json
{
  "title": "Review chapter four notes",
  "priority": "medium"
}
```

An update body must contain at least one field. To clear a due date, send `"due_date": null`. To delete a task, send `DELETE /api/tasks/{task_id}`; success returns `204 No Content`.

### Validation and common responses

| Status | Meaning |
| --- | --- |
| `200 OK` | Successful read, login, or task update. |
| `201 Created` | Account or task created. |
| `204 No Content` | Successful logout or task deletion. |
| `401 Unauthorized` | Missing, invalid, or expired session; or incorrect login. |
| `403 Forbidden` | A state-changing API request is missing the required custom header. |
| `404 Not Found` | Task does not exist or does not belong to the signed-in student. |
| `409 Conflict` | An account with that email already exists. |
| `422 Unprocessable Entity` | Invalid fields, an invalid email/date/priority, or an empty update. |

Account names are 1–80 characters after trimming; email addresses must be valid; passwords are 8–128 characters. Task titles are 1–100 characters after trimming; descriptions are at most 500 characters. Task due dates use the ISO `YYYY-MM-DD` format.

## Example API session from PowerShell

`Invoke-RestMethod` accepts a web session that stores cookies between requests:

```powershell
$baseUrl = "http://127.0.0.1:8000"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{ "X-Requested-With" = "StudySpace" }

# Register. Use a new email address the first time.
$account = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/api/auth/register" `
  -WebSession $session `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    name = "Alex Morgan"
    email = "alex@example.com"
    password = "a-long-unique-password"
  } | ConvertTo-Json)

# Create a task using the login cookie from the same web session.
$task = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/api/tasks" `
  -WebSession $session `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    title = "Read chapter four"
    description = "Take notes on the key ideas."
    priority = "high"
    due_date = "2026-11-05"
  } | ConvertTo-Json)

# List this student's tasks.
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/tasks" -WebSession $session

# Update the task using its returned ID.
Invoke-RestMethod `
  -Method Patch `
  -Uri "$baseUrl/api/tasks/$($task.id)" `
  -WebSession $session `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ priority = "medium" } | ConvertTo-Json)

# Delete it.
Invoke-RestMethod `
  -Method Delete `
  -Uri "$baseUrl/api/tasks/$($task.id)" `
  -WebSession $session `
  -Headers $headers
```

## Database model

The application has two tables:

- **`users`**: UUID, name, unique email address, password hash, and account creation time.
- **`tasks`**: UUID, owning user UUID, title, description, priority, optional due date, and task creation time.

SQLAlchemy creates missing tables at app startup. Task ownership is enforced by scoping reads, edits, and deletes to the current account, as well as a foreign-key relationship to the user.

## Run tests

Install the development dependencies and run pytest:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Tests use an isolated in-memory SQLite database. They cover account registration and login, input validation, task CRUD, write-request checks, and task ownership between students.

## Known limitations

- PostgreSQL is configured for the Docker Compose setup. A local run defaults to SQLite unless `DATABASE_URL` is set.
- The app creates tables at startup with SQLAlchemy `create_all`; there is no migration tool or schema-version history yet. For future production schema changes, add migrations before changing models.
- Account recovery, password reset, email verification, account deletion, and profile editing are not implemented.
- There is no task-completion status, sorting controls, pagination, attachments, or notifications.
- Search and task filters run in the browser over the signed-in student's loaded tasks; they are not server-side query parameters.
- The focus timer is a browser-only utility and is not saved to the account or resumed after a page reload.
- Registration and login do not currently have rate limiting or CAPTCHA.
- Sign-out clears the browser's cookie. A previously copied signed JWT is accepted until its seven-day expiry or until the signing key is changed; the app does not maintain a server-side token revocation list.
- Production deployment requires HTTPS, secure secret management, and an external reverse proxy or hosting platform. The included Compose file is a local deployment baseline, not a complete production operations setup.
