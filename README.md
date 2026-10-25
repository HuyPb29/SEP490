# SEP490 - Badminton Court Management System (BMS)

| Layer    | Tech                                   |
|----------|----------------------------------------|
| Frontend | ReactJS (Vite) + TailwindCSS           |
| Backend  | Java 21, Spring Boot, REST API         |
| Database | Microsoft SQL Server (`bms_db`)        |

## Structure
- `frontend/` - React app (http://localhost:5173)
- `backend/`  - Spring Boot app (http://localhost:8080)
- `BMSquery.sql` - database schema (creates `bms_db`, drops & recreates tables)

## Setup
1. **Database**: run `BMSquery.sql` in SSMS / Azure Data Studio against your SQL Server. Enable TCP/IP and make sure the instance listens on a port.
2. **Backend**: set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (see `backend/.env.example`), then
   ```
   cd backend
   .\mvnw spring-boot:run
   ```
3. **Frontend**:
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Requests to `/api/*` are proxied to the backend.

## Git workflow
Branch from `main` (`feature/<name>`), commit with GitHub Desktop, open a Pull Request, get a review, then merge.
