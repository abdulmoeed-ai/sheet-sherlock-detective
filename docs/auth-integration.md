# Auth Integration

The frontend now uses the backend authentication API instead of allowing anonymous access to the app shell.

## Backend Endpoints

- `POST /api/auth/register`: creates a user with a human role.
- `POST /api/auth/login`: returns access and refresh tokens.
- `GET /api/auth/me`: returns the authenticated user and role.

## Supported Signup Roles

- `finance_analyst`
- `finance_manager`
- `cfo`
- `admin`

The Sheet Sherlock System role in the workflow diagram is not selectable. It represents internal AI/audit activity, not a human account.

## Local Configuration

By default the frontend calls `http://127.0.0.1:8000`. Override this with `VITE_API_BASE_URL` when the backend runs elsewhere.
