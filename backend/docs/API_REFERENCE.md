# SynapStore API Reference

This document provides a clean, prompt-friendly reference for frontend developers integrating with the SynapStore API.
All API routes are prefixed with `/api/v1`.

## Authentication

### 1. Register User
Registers a new user (admin, store owner, or supplier) and sends an OTP to their email.

- **Endpoint**: `POST /auth/register`
- **Payload**:
  ```json
  {
    "username": "OwnerUser",
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "message": "registered - otp sent",
    "user": { "id": "uuid...", "email": "user@example.com" }
  }
  ```

### 2. Verify OTP
Verifies the email address using the OTP received in email/console.

- **Endpoint**: `POST /auth/verify-otp`
- **Payload**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Response**: `{ "message": "otp verified" }`

### 3. Sign In
Authenticates the user and returns a JWT token.

- **Endpoint**: `POST /auth/signin`
- **Payload**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": { ... }
  }
  ```
> **Note**: Save the `token` and send it in the `Authorization: Bearer <token>` header for all subsequent requests.

---

## Store Management

### 1. Create Store
Creates a new store for the signed-in user.

- **Endpoint**: `POST /store/create`
- **Headers**: `Authorization: Bearer <token>`
- **Payload**:
  ```json
  {
    "name": "My Pharmacy",
    "slug": "my-pharmacy",
    "currency": "USD"
  }
  ```
- **Response**: Returns the created store object.

---

## Supplier Management

### 1. Create Global Supplier Profile
Registers the current user as a global supplier.

- **Endpoint**: `POST /suppliers/global`
- **Headers**: `Authorization: Bearer <token>`
- **Payload**:
  ```json
  {
    "name": "Global Mega Supplier",
    "contactName": "John Doe"
  }
  ```

### 2. Request Access to Store (As Supplier)
A supplier requests permission to supply products to a specific store.

- **Endpoint**: `POST /supplier-requests`
- **Payload**:
  ```json
  {
    "storeId": "store-uuid",
    "supplierId": "supplier-uuid",
    "message": "We offer great prices."
  }
  ```

### 3. Accept Supplier Request (As Store Owner)
The store owner accepts a pending supplier request.

- **Endpoint**: `POST /supplier-requests/:id/accept`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `x-store-id`: `<store-id>`
- **Response**: `{ "success": true, "message": "accepted" }`

---

## Inventory & Machine Learning

### 1. Initiate Inventory Upload
Starts an ML-driven inventory ingestion process (e.g., from CSV/Excel).

- **Endpoint**: `POST /inventory/upload-init`
- **Headers**: `x-store-id: <store-id>`
- **Payload**:
  ```json
  { "filename": "inventory.xlsx" }
  ```
- **Response**: `{ "uploadId": "uuid..." }`

### 2. Check Upload Status
Poll status of the upload.

- **Endpoint**: `GET /inventory/upload/:uploadId`
- **Response**: `{ "status": "PENDING" | "PROCESSING" | "COMPLETED" }`

---

## Sales (POS)

### 1. Create Sale
Records a new sale transaction.

- **Endpoint**: `POST /sales`
- **Headers**: `x-store-id: <store-id>`
- **Payload**:
  ```json
  {
    "items": [
      { "medicineId": "uuid...", "qty": 2, "unitPrice": 10.50 }
    ]
  }
  ```
- **Response**: Returns created sale object with `PENDING` status.

### 2. Pay Sale
Completes the sale by recording payment. This deducts inventory.

- **Endpoint**: `POST /sales/:saleId/pay`
- **Payload**:
  ```json
  { "paymentMethod": "CASH" } // or CARD, UPI
  ```

### 3. Get Receipt
Retrieves the HTML receipt for the sale.

- **Endpoint**: `GET /sales/:saleId/receipt`
- **Response**: HTML content.

---

## Notifications

### 1. Get Notifications
Fetches notifications for the user or the store context.

- **Endpoint**: `GET /notifications`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `x-store-id`: optional (if fetching store-specific notifications)

---

## Admin (Superadmin Only)

### 1. Stats
Get global system statistics.

- **Endpoint**: `GET /admin/stats`
- **Response**: `{ "counts": { "users": 10, "stores": 5, ... } }`

### 2. List & Suspend Stores
- **List**: `GET /admin/stores`
- **Suspend**: `PATCH /admin/stores/:id/suspend` -> `{ "isActive": false }`
