# Role-Based Authentication & Dashboard Routing

## Overview
This document outlines all the authentication response permutations from the backend API and their corresponding UI redirects.

## API Response Permutations

### 1. SUPERADMIN Role
**Endpoint:** `/api/v1/auth/signin`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "5f4f744e-d611-4136-9417-c17428d329f6",
    "username": "admin_user",
    "email": "admin@example.com",
    "globalRole": "SUPERADMIN"
  },
  "effectiveStore": null,
  "stores": []
}
```

**Redirect:** `/admin/dashboard` → `SuperAdminDashboard.tsx`

**Features:**
- Global system management
- View all stores
- Manage all users
- System logs and activity monitoring
- Full administrative access

---

### 2. SUPPLIER Role
**Endpoint:** `/api/v1/auth/signin`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123-def456-ghi789",
    "username": "supplier_user",
    "email": "supplier@example.com",
    "globalRole": "SUPPLIER"
  },
  "supplierId": {
    "id": "supplier-uuid-123"
  }
}
```

**Redirect:** `/supplier/dashboard` → `SupplierDashboard.tsx`

**Features:**
- Product catalog management
- Order tracking
- Invoice management
- Revenue analytics
- Pending orders view

---

### 3. STORE_OWNER - No Stores (Needs Setup)
**Endpoint:** `/api/v1/auth/signin`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "store-owner-123",
    "username": "owner_user",
    "email": "owner@example.com",
    "globalRole": "STORE_OWNER"
  },
  "effectiveStore": null,
  "needsStoreSetup": true
}
```

**Redirect:** `/store/create` → `StoreCreate.tsx`

**Features:**
- Store creation wizard
- Business information setup
- Initial configuration

---

### 4. STORE_OWNER - Single Store
**Endpoint:** `/api/v1/auth/signin`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "store-owner-123",
    "username": "owner_user",
    "email": "owner@example.com",
    "globalRole": "STORE_OWNER"
  },
  "effectiveStore": {
    "id": "store-uuid-123",
    "name": "My Store",
    "slug": "my-store",
    "timezone": "America/New_York",
    "currency": "USD",
    "settings": {},
    "roles": ["OWNER"]
  }
}
```

**Redirect:** `/store/dashboard` → `StoreOwnerDashboard.tsx`

**Features:**
- Revenue and sales analytics
- Inventory management
- Order tracking
- Customer management
- Quick actions for common tasks

---

### 5. STORE_OWNER - Multiple Stores (Needs Selection)
**Endpoint:** `/api/v1/auth/signin`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "store-owner-123",
    "username": "owner_user",
    "email": "owner@example.com",
    "globalRole": "STORE_OWNER"
  },
  "effectiveStore": null,
  "stores": [
    {
      "role": "OWNER",
      "store": {
        "id": "store-1",
        "name": "Store One",
        "slug": "store-one",
        "timezone": "America/New_York",
        "currency": "USD",
        "settings": {}
      }
    },
    {
      "role": "MANAGER",
      "store": {
        "id": "store-2",
        "name": "Store Two",
        "slug": "store-two",
        "timezone": "America/Los_Angeles",
        "currency": "USD",
        "settings": {}
      }
    }
  ],
  "needsStoreSelection": true
}
```

**Redirect:** `/store/dashboard` → `StoreOwnerDashboard.tsx`

**Note:** Future enhancement needed for store selection UI

---

### 6. Google OAuth - New User
**Endpoint:** `/api/v1/oauth/google`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "google-user-123",
    "username": "John Doe",
    "email": "john@gmail.com",
    "globalRole": null
  },
  "effectiveStore": null,
  "needsStoreSetup": true,
  "suppliers": []
}
```

**Redirect:** `/store/create` → `StoreCreate.tsx`

---

### 7. Google OAuth - Existing Store Owner
**Endpoint:** `/api/v1/oauth/google`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "google-user-123",
    "username": "John Doe",
    "email": "john@gmail.com",
    "globalRole": "STORE_OWNER"
  },
  "effectiveStore": {
    "id": "store-uuid-123",
    "name": "My Store",
    "slug": "my-store",
    "roles": ["OWNER"]
  },
  "suppliers": []
}
```

**Redirect:** `/store/dashboard` → `StoreOwnerDashboard.tsx`

---

## UI Pages Created

### 1. SuperAdminDashboard.tsx
**Path:** `/client/src/pages/SuperAdminDashboard.tsx`
**Route:** `/admin/dashboard`
**Role:** SUPERADMIN

**Design Features:**
- Purple/Pink gradient theme
- System stats (stores, users, sessions, health)
- Quick actions for system management
- Glassmorphism effects
- Framer Motion animations

---

### 2. SupplierDashboard.tsx
**Path:** `/client/src/pages/SupplierDashboard.tsx`
**Route:** `/supplier/dashboard`
**Role:** SUPPLIER

**Design Features:**
- Emerald/Teal gradient theme
- Supplier stats (products, orders, invoices, revenue)
- Quick actions (products, pending orders, invoices)
- Recent orders section
- Glassmorphism effects
- Framer Motion animations

---

### 3. StoreOwnerDashboard.tsx
**Path:** `/client/src/pages/StoreOwnerDashboard.tsx`
**Route:** `/store/dashboard`
**Role:** STORE_OWNER

**Design Features:**
- Emerald/Teal gradient theme
- Business stats (revenue, orders, products, customers)
- Quick actions (inventory, new sale, customers, reports)
- Sales overview chart placeholder
- Recent activity section
- Glassmorphism effects
- Framer Motion animations

---

## Authentication Flow

1. **User logs in** via `/login` page
2. **Backend validates** credentials and returns role-specific response
3. **Frontend receives** response and stores in Recoil state
4. **Login handler** (`handleAuthSuccess`) checks `globalRole`:
   - `SUPERADMIN` → `/admin/dashboard`
   - `SUPPLIER` → `/supplier/dashboard`
   - `STORE_OWNER` with `needsStoreSetup: true` → `/store/create`
   - `STORE_OWNER` with store → `/store/dashboard`
   - Default fallback → `/dashboard`
5. **Protected routes** ensure authentication via `RequireAuth` component

---

## State Management

### Updated AuthState (auth.ts)
```typescript
export type AuthState = {
  token: string | null;
  user: AuthUser | null;
  effectiveStore: EffectiveStore | null;
  needsStoreSetup: boolean;
  needsStoreSelection?: boolean;
  suppliers?: Array<{ id: string; storeId: string | null; name: string; isActive: boolean }>;
  supplierId?: { id: string } | null; // NEW: For supplier users
};
```

---

## Design Consistency

All role-specific dashboards maintain:
- ✅ Premium glassmorphism aesthetic
- ✅ Smooth Framer Motion animations
- ✅ Consistent color schemes per role
- ✅ Responsive layouts
- ✅ Modern typography
- ✅ Hover effects and micro-interactions
- ✅ Clean, professional UI matching login page style

---

## Testing Scenarios

1. **SUPERADMIN Login**
   - Login with SUPERADMIN credentials
   - Verify redirect to `/admin/dashboard`
   - Verify purple/pink themed dashboard loads

2. **SUPPLIER Login**
   - Login with SUPPLIER credentials
   - Verify redirect to `/supplier/dashboard`
   - Verify emerald/teal themed dashboard loads
   - Verify supplierId is stored in state

3. **STORE_OWNER (No Store)**
   - Login with new STORE_OWNER credentials
   - Verify redirect to `/store/create`
   - Complete store setup
   - Verify redirect to `/store/dashboard`

4. **STORE_OWNER (With Store)**
   - Login with existing STORE_OWNER credentials
   - Verify redirect to `/store/dashboard`
   - Verify store information displays correctly

5. **Google OAuth**
   - Sign in with Google
   - Verify appropriate redirect based on account status
   - Verify state persistence

---

## Notes

- All existing functionality preserved
- No breaking changes to authentication logic
- UI matches premium aesthetic of login page
- All routes protected with `RequireAuth`
- State properly persisted in localStorage
- Responsive design for all screen sizes
