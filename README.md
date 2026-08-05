# Document Flow SWD

Physical document custody tracking for Smart World Developers. Tracks where every
company document physically is — in the **storage room** or **with a specific employee** —
with an admin-approved issue/return workflow.

## How it works

A document is always in exactly one of four states:

```
in_storage  --request take-->  pending_out  --admin approve-->  with_employee
with_employee  --request return-->  pending_return  --admin approve-->  in_storage
```

- Only documents `in_storage` can be requested. Once a document is with an employee it is
  **locked** — no one else can request it until it is returned to storage.
- **No employee-to-employee handoffs.** Everything routes back through the storage room.
- **Admin** approves/rejects every issue and every return, sees live locations, manages users.
- **Users** (one login per employee) request takes/returns, see their own custody, and
  change their own password.

## Stack

- Backend: Node/Express + `mssql` + JWT (`backend/`)
- Frontend: React + Vite (`frontend/`)
- Database: SQL Server (schema in `backend/schema.sql`)

## Setup (Windows / PowerShell)

### 1. Database
Create a database (e.g. `DocFlowDB`) on your SQL Server (`192.168.66.33`), then run the schema:
```
sqlcmd -S 192.168.66.33 -d DocFlowDB -U <user> -P <pass> -i backend\schema.sql
```

### 2. Backend
```
cd backend
copy .env.example .env      # then edit .env with your DB creds + secrets
npm install
```
Load master data (put your Excel files in `backend\master\` first — see below), then create logins:
```
npm run load-master
npm run seed
npm start                   # API on http://0.0.0.0:5096
```

### 3. Master data files
Place in `backend\master\`:
- `employees.xlsx` — columns: `employee_id, name, department, designation, email`
- `documents.xlsx` — columns: `document_id, tower, flat_number, doc_type, remarks`

Column names are matched case-insensitively; extra columns are ignored.

`seed.js` creates:
- one **admin** login (from `.env`: `ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- one **user** login per employee — username = `employee_id`, default password =
  `DEFAULT_USER_PASSWORD`, forced to change on first login.

### 4. Frontend
```
cd frontend
npm install
npm run dev                 # dev server on http://localhost:5173 (proxies /api to :5096)
```
For production: `npm run build` and serve `frontend/dist` behind the same host as the API
(the frontend calls `/api` same-origin by default; override with `VITE_API_BASE`).

## API summary

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| POST | /api/auth/login | all | login |
| POST | /api/auth/change-password | all | change own password |
| GET  | /api/documents | all | live list + current location |
| GET  | /api/documents/mine | user | documents in my custody |
| GET  | /api/documents/:id/history | all | full custody trail |
| POST | /api/movements/request-take | user | request to take from storage |
| POST | /api/movements/request-return | user | request to return to storage |
| GET  | /api/movements/pending | admin | approval queue |
| POST | /api/movements/:id/decide | admin | approve / reject |
| GET  | /api/users | admin | list users |
| POST | /api/users/:id/reset-password | admin | reset to default password |
