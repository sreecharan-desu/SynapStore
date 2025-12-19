# SynapStore API Specification

Base URL: `http://localhost:3000/api/v1` (Assuming standard port)

## Authentication

### Register
**POST** `/auth/register`
- **Body**: `{ username: string, email: string, password: string }`
- **Response**: `{ message: string, user: { id, username, email } }`
- **Description**: Registers a new user and sends an OTP to the email.


### Login
**POST** `/auth/signin`
- **Body**: `{ email: string, password: string }`
- **Response**: 
  ```json
  {
    "token": "jwt...",
    "user": { ... },
    "effectiveStore": { ... } | null,
    "needsStoreSetup": boolean,
    "stores": [ ... ]
  }
  ```
- **Description**: Authenticates user. partial response if store setup is needed.

### Verify OTP
**POST** `/auth/verify-otp`
- **Body**: `{ email: string, otp: string }`
- **Response**: `{ message: "otp verified" }`

### Resend OTP
**POST** `/auth/resend-otp`
- **Body**: `{ email: string }`
- **Response**: `{ message: "otp resent" }`

## Store

### Create Store
**POST** `/store/create`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ name: string, slug: string, timezone?: string, currency?: string }`
- **Response**: `{ success: true, message: "store created", effectiveStore: { ... } }`

## Dashboard

### Bootstrap / Overview
**GET** `/dashboard/bootstrap`
- **Headers**: `Authorization: Bearer <token>`
- **Query**: `days=30`, `top=10`, `recent=20`
- **Response**: Returns a massive object with `user`, `store`, `overview`, `charts`, `lists` (low stock, expiries, recent sales).

### Store Info
**GET** `/dashboard/store`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ success: true, data: { user, store, roles, permissions } }`

## Sales

### Create Sale
**POST** `/sales`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: 
  ```json
  {
    "items": [
      { "medicineId": "uuid", "qty": 1, "unitPrice": 10.00, "inventoryBatchId": "optional-uuid" }
    ],
    "paymentMethod": "CASH | CARD | UPI...",
    "discounts": 0,
    "tax": 0
  }
  ```
- **Response**: `{ success: true, sale: { ... } }`

### Pay Sale
**POST** `/sales/:id/pay`
- **Body**: `{ paymentMethod: string, externalRef?: string }`
- **Response**: `{ success: true, sale: { ... } }`

### Receipt
**GET** `/sales/:id/receipt`
- **Response**: HTML string.

## Inventory (Uploads only)

### Init Upload
**POST** `/inventory/upload-init`
- **Body**: `{ filename?: string, metadata?: any }`
- **Response**: `{ success: true, uploadId: string, status: "PENDING" }`

### Get Upload Status
**GET** `/inventory/upload/:id`
- **Response**: `{ success: true, status: string, ... }`

### Update Upload Status
**PATCH** `/inventory/upload/:id/status`
- **Body**: `{ status: "APPLIED" | ... , metadata?: any }`
- **Description**: If status becomes `APPLIED`, sends receipt emails.

## Suppliers

### Create Global Supplier
**POST** `/suppliers/global`
- **Body**: `{ name, address?, phone?, contactName?, defaultLeadTime?, defaultMOQ? }`
- **Response**: `{ success: true, data: { supplier } }`

### List Global Suppliers
**GET** `/suppliers/global?q=...`
- **Response**: `{ success: true, data: { suppliers: [] } }`

## Admin (Global)

### Stats
**GET** `/admin/stats` (SUPERADMIN only)

### Stores
**GET** `/admin/stores` (SUPERADMIN only)
**PATCH** `/admin/stores/:id/suspend`

### Suppliers
**GET** `/admin/suppliers` (SUPERADMIN only)
**PATCH** `/admin/suppliers/:id/suspend`

### Users
**POST** `/admin/users/:userId/impersonate`
**POST** `/admin/users/:userId/convert-to-supplier`

## Missing Endpoints (To be Mocked in Frontend)

- **Medicine CRUD**: Create, Update, Delete Medicine.
- **Inventory Management**: Create Batch (Receive Stock), Adjust Stock.
- **User Management**: Add user to store, Manage Roles.
