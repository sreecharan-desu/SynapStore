# SynapStore Frontend

Complete React + TypeScript frontend for the SynapStore backend.

## Features

- **Authentication**: Login, Register, OTP Verification (Real API).
- **Dashboard**: High-level overview with charts (Real API).
- **Inventory**:
  - List medicines (Mocked until backend API provided).
  - Add Medicine (Mocked).
  - Bulk Upload (Real API).
- **Sales (POS)**:
  - Catalog search (Mocked + Real Top Movers).
  - Cart & Checkout (Real API `POST /sales`).
  - Receipt generation.
- **Suppliers**:
  - List & Create (Real API).
  - View details.

## Setup & Running

### Prerequisites
- Node.js 18+
- Redis (Required for Backend)
- PostgreSQL (Required for Backend)

### Backend
The backend has been patched to fix a compilation error (`webhookDelivery` query).
To run the backend:
```bash
cd backend
npm install
npm run dev
```
Note: Ensure Docker/Redis is running on default port 6379, or queries might fail.

### Frontend
To run the frontend:
```bash
cd client
npm install
npm run dev
```
Access at `http://localhost:5173`.

## Architecture
- **Tech Stack**: React, Vite, TailwindCSS, Recoil, React Query (via axios/useEffect), Recharts.
- **Route Guards**: `RequireAuth` protects dashboard routes.
- **API**: `src/lib/api/endpoints.ts` contains the full API layer.
- **Mocks**: Missing backend features (Create Medicine, Inventory Lists) are mocked in `endpoints.ts` using `localStorage` for persistence.

## API Specification
See `api-spec.md` for details on the discovered backend API surface.
