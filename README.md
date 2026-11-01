# SEP490 - Badminton Court Management System (BMS)

| Layer    | Tech                                   |
|----------|----------------------------------------|
| Frontend | ReactJS (Vite) + TailwindCSS           |
| Backend  | Java 21, Spring Boot, REST API         |
| Database | Microsoft SQL Server (`BMS`)           |

## Structure
- `frontend/` - React app (http://localhost:5173)
- `backend/`  - Spring Boot app (http://localhost:8080)
- `BMS_database.sql` - database schema (creates `BMS` with 35 tables; stops if `BMS` already has tables)

## Setup
1. **Database**: run `BMS_database.sql` in SSMS / Azure Data Studio (creates database `BMS` if missing). Enable TCP/IP for the instance and keep SQL Server Browser running when using a named instance.
2. **Backend**: open `backend/src/main/resources/application.properties` and change the server name, username and password to match your SQL Server, then
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
