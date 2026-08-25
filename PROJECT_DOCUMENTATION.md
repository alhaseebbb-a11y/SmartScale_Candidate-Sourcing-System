# SmartSkale Candidate Sourcing System — Technical & Architectural Documentation

---

## 1. Executive Summary

**SmartSkale** is a full-stack, enterprise-grade **Candidate Sourcing and Applicant Tracking System (ATS)** engineered to streamline hiring workflows for recruiters, hiring managers, and candidates. The platform facilitates job requisition publishing, deadline-driven application intake, automated multi-step email notifications, candidate profile management, in-page resume previewing via cloud storage, and an administrative evaluation grid.

---

## 2. Technology Stack & Cloud Infrastructure

### Frontend Architecture
- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS 4 + Lucide React Icons
- **State Management & Server Cache:** TanStack React Query v5
- **Form Management & Schema Validation:** React Hook Form v7 + Zod v4 (`@hookform/resolvers`)
- **HTTP Client:** Axios (Custom interceptors for 401 handling, token refresh, and bearer auth)
- **Notifications:** React Hot Toast
- **Hosting:** Vercel (Global Edge CDN Network with `vercel.json` SPA routing)

### Backend Architecture
- **Runtime & Framework:** Python 3.11+ / FastAPI (Asynchronous ASGI)
- **Database ORM:** SQLAlchemy 2.0 (AsyncIO) + Asyncpg Driver
- **Schema Migrations:** Alembic
- **Security & Cryptography:** Passlib (Bcrypt), PyJWT (HS256 Dual Token: Access + Refresh), HMAC-SHA256 (OTP Signatures)
- **Email Delivery:** Python SMTPLib (Dual-port SSL/TLS fallback) + Resend HTTPS REST API
- **Hosting:** Render (Linux Containerized Web Service)

### Cloud & Persistence Layer
- **Relational Database:** **AWS RDS PostgreSQL** (Engine: PostgreSQL 18.6 ARM64, Region: `eu-north-1`)
- **Object Storage:** **AWS S3** (`smartscalebucket`, Region: `eu-north-1`) for candidate resumes and documents
- **Email Provider:** Resend REST API (HTTPS Port 443) / Gmail SMTP (Ports 587 & 465)

---

## 3. High-Level System Architecture

```mermaid
graph TB
    subgraph Client Layer
        Browser["User Browser (Candidate / Admin)"]
    end

    subgraph Hosting & CDN
        VercelCDN["Vercel Edge Network<br/>(React 19 SPA)"]
        RenderService["Render Web Service<br/>(FastAPI Backend)"]
    end

    subgraph Cloud Infrastructure (AWS & Third-Party)
        AWSRDS[("AWS RDS PostgreSQL<br/>smartskale-db (eu-north-1)")]
        AWSS3[("AWS S3 Bucket<br/>smartscalebucket")]
        EmailService["Resend API / Gmail SMTP<br/>(Transactional Emails)"]
    end

    Browser -->|Serves Static Bundle| VercelCDN
    Browser -->|REST API Requests (JWT Auth)| RenderService
    RenderService -->|Async Queries (asyncpg)| AWSRDS
    RenderService -->|Uploads / Streams Resumes| AWSS3
    RenderService -->|Dispatches OTPs & Alerts| EmailService
```

---

## 4. End-to-End User & Business Flows

### A. Candidate Registration Flow with Mandatory Email OTP Verification

```mermaid
sequenceDiagram
    autonumber
    actor Candidate
    participant UI as Frontend (React)
    participant API as FastAPI Backend
    participant DB as AWS RDS
    participant Mail as Email Service (Resend/SMTP)

    Candidate->>UI: Enters Email on Register page & clicks "Send OTP"
    UI->>API: POST /api/v1/auth/send-email-otp { email }
    API->>DB: Check if User exists with email
    alt Email already registered
        API-->>UI: 409 Conflict ("Account already exists")
    else Email is new
        API->>API: Generate 6-digit numeric OTP & calculate HMAC-SHA256 hash
        API->>DB: Insert record into `email_verifications` (expires in 5 mins)
        API->>Mail: Dispatch OTP email
        API-->>UI: 200 OK ("Verification OTP sent successfully")
    end

    Candidate->>UI: Inputs 6-digit OTP & clicks "Verify OTP"
    UI->>API: POST /api/v1/auth/verify-email-otp { email, otp }
    API->>DB: Query active `email_verifications` record
    alt OTP Invalid or Expired
        API-->>UI: 400 Bad Request ("Invalid or expired OTP")
    else OTP Matches
        API->>DB: Update `is_verified = True`, `verified_at = NOW()`
        API-->>UI: 200 OK ("Email verified successfully")
    end

    Candidate->>UI: Enters First Name, Last Name, Password & clicks "Create Account"
    UI->>API: POST /api/v1/auth/register { email, password, first_name, last_name, mobile }
    API->>DB: Validate that recent verified OTP exists in DB
    API->>DB: Create `users` record (Bcrypt password) & `candidate_profiles` record
    API->>DB: Mark OTP record as `is_used = True`
    API-->>UI: 201 Created + Access & Refresh JWT Tokens (Auto-login)
```

---

### B. Job Requisition Lifecycle & Application Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    actor Candidate
    participant API as FastAPI Backend
    participant RDS as AWS RDS PostgreSQL
    participant S3 as AWS S3 Storage
    participant Mail as Email Service

    Admin->>API: POST /api/v1/admin/jobs (Create requisition with `application_end_date`)
    API->>RDS: Save Job with Status `DRAFT` or `PUBLISHED`
    
    Candidate->>API: GET /api/v1/jobs (Browse active jobs)
    API->>RDS: Filter jobs where status = `PUBLISHED` AND (`application_end_date` is null OR `application_end_date >= NOW()`)
    API-->>Candidate: List of eligible jobs

    Candidate->>API: POST /api/v1/jobs/{id}/apply (Multi-part: profile, education, experience, resume file)
    API->>S3: Upload resume document (PDF/DOCX) -> returns S3 key
    API->>RDS: Insert record in `applications`, `application_education`, `application_experience`
    API->>Mail: Send Application Confirmation to Candidate
    API->>Mail: Send New Application Alert to Recruiter/Admin
    API-->>Candidate: 201 Created (Returns unique `application_number`)
```

---

### C. Admin Evaluation Grid & Resume Viewer Flow

```mermaid
sequenceDiagram
    autonumber
    actor Recruiter as Admin / Recruiter
    participant UI as Admin Portal
    participant API as FastAPI Backend
    participant S3 as AWS S3
    participant RDS as AWS RDS

    Recruiter->>UI: Opens Candidate Evaluation Grid
    UI->>API: GET /api/v1/admin/applications (filters: status, job_id, search, pagination)
    API->>RDS: Execute query with joins on profiles, jobs, education, experience
    API-->>UI: Return tabular candidate data with badges & stage metrics

    Recruiter->>UI: Clicks "View Application"
    UI->>API: GET /api/v1/admin/applications/{id}
    API-->>UI: Consolidated application detail

    Recruiter->>UI: Views "Resume and Cover Note" tab
    UI->>API: GET /api/v1/admin/applications/{id}/resume (in `<iframe src="...">`)
    API->>S3: Fetch resume stream from AWS S3
    API-->>UI: Stream bytes with `Content-Type: application/pdf`, `Content-Disposition: inline`
    Note over UI: Recruiter reviews resume directly in the browser without local download!

    Recruiter->>UI: Updates Candidate Status (e.g. `SHORTLISTED` / `REJECTED`)
    UI->>API: PATCH /api/v1/admin/applications/{id}/status { status, notes }
    API->>RDS: Update status & append history
    API->>Mail: Automatically email candidate regarding status update
    API-->>UI: 200 OK (Status updated successfully)
```

---

## 5. Database Schema & Data Models

### Entity Relationship Model

```mermaid
erDiagram
    USERS ||--o{ CANDIDATE_PROFILES : "has profile"
    USERS ||--o{ NOTIFICATIONS : "receives"
    CANDIDATE_PROFILES ||--o{ EDUCATION : "has"
    CANDIDATE_PROFILES ||--o{ WORK_EXPERIENCE : "has"
    CANDIDATE_PROFILES ||--o{ APPLICATIONS : "submits"
    JOBS ||--o{ APPLICATIONS : "receives"
    APPLICATIONS ||--o{ APPLICATION_EDUCATION : "snapshots"
    APPLICATIONS ||--o{ APPLICATION_EXPERIENCE : "snapshots"
    EMAIL_VERIFICATIONS

    USERS {
        uuid id PK
        string email UK
        string password_hash
        enum role "CANDIDATE, ADMIN"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    EMAIL_VERIFICATIONS {
        uuid id PK
        string email
        string otp_hash
        timestamp expires_at
        integer attempt_count
        boolean is_verified
        boolean is_used
        timestamp verified_at
        timestamp created_at
    }

    JOBS {
        uuid id PK
        string requisition_id UK
        string title
        string department
        string location
        enum employment_type "FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP"
        string experience_range
        integer openings
        string hiring_manager
        text responsibilities
        text requirements
        enum status "DRAFT, PUBLISHED, CLOSED"
        date posted_date
        date application_end_date
        timestamp created_at
        timestamp updated_at
    }

    CANDIDATE_PROFILES {
        uuid id PK
        uuid user_id FK
        string first_name
        string last_name
        enum gender "MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY"
        string mobile
        date date_of_birth
        string current_location
        string highest_qualification
        string current_company
        enum notice_period "IMMEDIATE, 15_DAYS, 30_DAYS, 60_DAYS, 90_PLUS_DAYS"
        text current_address
        string photo_path
        timestamp updated_at
    }

    APPLICATIONS {
        uuid id PK
        string application_number UK
        uuid candidate_profile_id FK
        uuid job_id FK
        enum status "NEW, REVIEWED, SHORTLISTED, REJECTED"
        string resume_path
        string resume_filename
        text cover_note
        boolean consent_accuracy
        boolean consent_privacy
        text admin_notes
        timestamp submitted_at
        timestamp reviewed_at
    }

    EDUCATION {
        uuid id PK
        uuid candidate_profile_id FK
        string degree
        string specialization
        string institution
        string board
        string stream
        integer year_of_passing
        string grade
        enum level "HIGH_SCHOOL, DIPLOMA, BACHELORS, MASTERS, DOCTORATE, SECONDARY_SCHOOL, HIGHER_SECONDARY"
    }

    WORK_EXPERIENCE {
        uuid id PK
        uuid candidate_profile_id FK
        string company
        string title
        date start_date
        date end_date
        boolean currently_working
        text responsibilities
    }

    APPLICATION_EDUCATION {
        uuid id PK
        uuid application_id FK
        string degree
        string specialization
        string institution
        string board
        string stream
        integer year_of_passing
        string grade
        enum level
    }

    APPLICATION_EXPERIENCE {
        uuid id PK
        uuid application_id FK
        string company
        string title
        date start_date
        date end_date
        boolean currently_working
        text responsibilities
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string title
        text message
        string notification_type
        boolean is_read
        timestamp created_at
    }
```

---

## 6. Comprehensive REST API Specification

### Base URLs
- **Production API:** `https://smartscale-candidate-sourcing-system.onrender.com/api/v1`
- **Swagger Documentation:** `https://smartscale-candidate-sourcing-system.onrender.com/docs`

---

### Authentication Endpoints (`/auth`)

| Method | Endpoint | Access | Description | Request Body | Response |
|---|---|---|---|---|---|
| `POST` | `/auth/send-email-otp` | Public | Generate and email a 5-minute OTP for verification | `{ "email": "string" }` | `200 OK` (Message) |
| `POST` | `/auth/verify-email-otp` | Public | Validate OTP before account creation | `{ "email": "string", "otp": "string" }` | `200 OK` (Verified status) |
| `POST` | `/auth/register` | Public | Register new candidate account (requires verified OTP) | `{ "email", "password", "first_name", "last_name", "mobile" }` | `201 Created` + JWT tokens |
| `POST` | `/auth/login` | Public | Authenticate user (Candidate / Admin) | `{ "email": "string", "password": "string" }` | `200 OK` + JWT tokens + Role |
| `POST` | `/auth/refresh` | Public | Refresh expired access token using refresh token | `{ "refresh_token": "string" }` | `200 OK` + New access token |
| `GET` | `/auth/me` | Authenticated | Retrieve currently authenticated user info | Header: `Bearer <token>` | `200 OK` (User details) |
| `POST` | `/auth/forgot-password` | Public | Initiate password reset email | `{ "email": "string" }` | `200 OK` (Generic message) |
| `POST` | `/auth/reset-password` | Public | Complete password reset with token | `{ "token": "string", "new_password": "string" }` | `200 OK` |

---

### Public Job Endpoints (`/jobs`)

| Method | Endpoint | Access | Description | Query Parameters | Response |
|---|---|---|---|---|---|
| `GET` | `/jobs` | Public | List open/published job requisitions | `page`, `page_size`, `department`, `search`, `location` | `200 OK` (Paginated items) |
| `GET` | `/jobs/{id}` | Public | Retrieve full job requisition details | Path: `id` (UUID) | `200 OK` (Job object) |
| `POST` | `/jobs/{id}/apply` | Candidate | Submit job application with snapshot & resume | `multipart/form-data` (`data` JSON + `resume` File) | `201 Created` (Application #) |

---

### Candidate Profile & Experience Endpoints (`/candidate`)

| Method | Endpoint | Access | Description | Request Body | Response |
|---|---|---|---|---|---|
| `GET` | `/candidate/profile` | Candidate | Get profile data | None | `200 OK` (ProfileResponse) |
| `PUT` | `/candidate/profile` | Candidate | Update bio & contact details | ProfileUpdate JSON | `200 OK` (Updated profile) |
| `POST` | `/candidate/photo` | Candidate | Upload candidate display picture | `multipart/form-data` | `200 OK` (`photo_url`) |
| `GET` | `/candidate/education` | Candidate | List education records | None | `200 OK` (`EducationOut[]`) |
| `POST` | `/candidate/education` | Candidate | Add education record | EducationCreate JSON | `201 Created` |
| `PUT` | `/candidate/education/{id}` | Candidate | Update education record | EducationCreate JSON | `200 OK` |
| `DELETE` | `/candidate/education/{id}` | Candidate | Delete education record | Path: `id` | `204 No Content` |
| `GET` | `/candidate/experience` | Candidate | List work experience records | None | `200 OK` (`ExperienceOut[]`) |
| `POST` | `/candidate/experience` | Candidate | Add work experience record | ExperienceCreate JSON | `201 Created` |
| `PUT` | `/candidate/experience/{id}` | Candidate | Update work experience record | ExperienceCreate JSON | `200 OK` |
| `DELETE` | `/candidate/experience/{id}` | Candidate | Delete work experience record | Path: `id` | `204 No Content` |
| `GET` | `/candidate/experience-summary` | Candidate | Auto-calculated total months & years | None | `200 OK` (`total_months`, `total_years`) |
| `GET` | `/candidate/applications` | Candidate | List candidate's submitted applications | None | `200 OK` (Applications list) |
| `GET` | `/candidate/applications/{id}` | Candidate | Retrieve specific application details | Path: `id` | `200 OK` |

---

### Administrative Endpoints (`/admin`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/admin/jobs` | Admin | List all job requisitions (Draft, Published, Closed) with applicant counts |
| `POST` | `/admin/jobs` | Admin | Create a new job requisition |
| `GET` | `/admin/jobs/{id}` | Admin | Retrieve job requisition detail |
| `PUT` | `/admin/jobs/{id}` | Admin | Update job requisition details |
| `PATCH` | `/admin/jobs/{id}/status` | Admin | Change job status (`DRAFT`, `PUBLISHED`, `CLOSED`) |
| `GET` | `/admin/applications` | Admin | Filter and search all candidate applications across all jobs |
| `GET` | `/admin/applications/{id}` | Admin | Get consolidated candidate profile, snapshot data, and notes |
| `GET` | `/admin/applications/{id}/resume` | Admin | Stream resume for embedded PDF viewer |
| `GET` | `/admin/applications/{id}/resume/download` | Admin | Download resume file |
| `PATCH` | `/admin/applications/{id}/status` | Admin | Update candidate status (`REVIEWED`, `SHORTLISTED`, `REJECTED`) and trigger email |
| `GET` | `/admin/applications/export/csv` | Admin | Export filtered applicant records as CSV |
| `GET` | `/admin/notifications` | Admin | List system notification alerts |

---

## 7. Security & Cryptographic Architecture

1. **Password Hashing:**
   - Handled via **Bcrypt** with salt rounds managed by `passlib.context.CryptContext`. Plaintext passwords are never persisted.
2. **Session Authentication:**
   - Signed JSON Web Tokens (**JWT**) with `HS256` encryption.
   - Access token lifetime: 60 minutes.
   - Refresh token lifetime: 7 days.
3. **Email OTP Verification:**
   - 6-digit cryptographically secure pseudorandom numbers generated via Python's `secrets` module.
   - Stored in AWS RDS as an **HMAC-SHA256** hash salted with the user's email address and server secret.
   - Enforces a 5-minute strict time-to-live (TTL) and a 5-attempt rate limit.
4. **Cloud Storage Isolation (AWS S3):**
   - Candidate resumes are stored using randomized UUID keys.
   - Direct public bucket listing and anonymous access are disabled.
   - Resumes are streamed securely through the authenticated backend proxy endpoint.
5. **CORS & Network Security:**
   - Automated regular-expression matching for all authorized Vercel domains (`r"^https://.*\.vercel\.app$"`).
   - Strict Content Security headers and parameterized SQL queries preventing SQL Injection.

---

## 8. Deployment & Environment Variables

### Production Backend Environment (`Render`)

```env
ENV=production
DATABASE_URL=postgresql+asyncpg://postgres:<password>@smartskale-db.cduomwsu8or0.eu-north-1.rds.amazonaws.com:5432/postgres
JWT_SECRET_KEY=c9fec901389f631394c42c025f449b3e637ebecfbf13621d9421e9f1acd40ee0
STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=AKIA3IX4M63H62BJZF5H
AWS_SECRET_ACCESS_KEY=<AWS_SECRET_KEY>
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=smartscalebucket
RESEND_API_KEY=re_your_api_key_here
EMAIL_BACKEND=auto
FRONTEND_URL=https://smart-scale-candidate-sourcing-system.vercel.app
CORS_ORIGINS=https://smart-scale-candidate-sourcing-system.vercel.app,http://localhost:5173
SEED_ADMIN_EMAIL=hasibshaikh583@gmail.com
SEED_ADMIN_PASSWORD=Admin@12345
```

### Production Frontend Environment (`Vercel`)

```env
VITE_API_URL=https://smartscale-candidate-sourcing-system.onrender.com/api/v1
```

---

## 9. Conclusion & Maintainability

The **SmartSkale Candidate Sourcing System** is completely decoupled, production-ready, and independently scalable:
* The **React 19 Frontend** delivers lightning-fast UI rendering with zero cold starts via Vercel's global CDN.
* The **FastAPI Backend** on Render manages business rules, authentication, and background processes asynchronously.
* Persistent structured relational data resides securely in **AWS RDS PostgreSQL**, while unstructured documents are stored durably in **AWS S3**.
* Transactional emails (OTPs, application acknowledgments, and recruiter alerts) are delivered with sub-second response times over modern HTTPS APIs.
