import { client } from "./client";
import type { User, AuthResponse, Store, Supplier, SupplierRequest, AdminStats } from "../types";


// --- Auth ---
export const authApi = {
    register: (data: { username: string; email: string; password: string }) =>
        client.post("/auth/register", data),

    signin: (data: { email: string; password: string }) =>
        client.post<AuthResponse>("/auth/signin", data),

    verifyOtp: (data: { email: string; otp: string }) =>
        client.post("/auth/verify-otp", data),

    resendOtp: (data: { email: string }) =>
        client.post("/auth/resend-otp", data),
};

// --- Store ---
export const storeApi = {
    create: (data: { name: string; slug: string; timezone?: string; currency?: string }) =>
        client.post<{ success: boolean; effectiveStore: Store }>("/store/create", data),
};

// --- Dashboard ---
export const dashboardApi = {
    getStore: () => client.get<{ success: boolean; data: { user: User; store: Store; roles: string[] } }>("/dashboard/store"),
    getBootstrap: (params?: any) => client.get<any>("/dashboard/bootstrap", { params }),
    
    // Supplier Requests (Store Owner View)
    getSupplierRequests: () => client.get<{ success: boolean; data: SupplierRequest[] }>("/dashboard/supplier-requests"),
    acceptSupplierRequest: (id: string) => client.post<{ success: boolean; message: string }>(`/dashboard/${id}/accept`),
    rejectSupplierRequest: (id: string) => client.post<{ success: boolean; message: string }>(`/dashboard/${id}/reject`),
};

// --- Suppliers ---
export const suppliersApi = {
    listGlobal: (q?: string) => client.get<{ success: boolean; data: { suppliers: Supplier[] } }>("/suppliers/global", { params: { q } }),
    createGlobal: (data: Partial<Supplier>) => client.post<{ success: boolean; data: { supplier: Supplier } }>("/suppliers/global", data),
    
    getDiscoveryStores: () => client.get<{ success: boolean; data: { stores: Store[] } }>("/suppliers/discovery"),
    createRequest: (data: { storeId: string; supplierId: string; message?: string }) => client.post<{ success: boolean; data: { request: SupplierRequest } }>("/suppliers", data),
    getDetails: (supplierId?: string) => client.get<{ success: boolean; data: { supplier: Supplier; requests: SupplierRequest[] } }>("/suppliers", { params: { supplierId } }),
};

// --- Admin ---
export const adminApi = {
    getStats: () => client.get<{ success: boolean; data: AdminStats }>("/admin/stats"),
    impersonateUser: (userId: string) => client.post<{ success: boolean; data: { token: string; user: User } }>(`/admin/users/${userId}/impersonate`),
    
    getStores: (params?: { q?: string; showInactive?: boolean }) => client.get<{ success: boolean; data: { stores: Store[] } }>("/admin/stores", { params }),
    suspendStore: (storeId: string, isActive: boolean) => client.patch<{ success: boolean; data: { store: Store } }>(`/admin/stores/${storeId}/suspend`, { isActive }),
    deleteStore: (storeId: string) => client.delete(`/admin/stores/${storeId}`),
    
    getSuppliers: (q?: string) => client.get<{ success: boolean; data: { suppliers: Supplier[] } }>("/admin/suppliers", { params: { q } }),
    suspendSupplier: (supplierId: string, isActive: boolean) => client.patch<{ success: boolean; data: { supplier: Supplier } }>(`/admin/suppliers/${supplierId}/suspend`, { isActive }),
    deleteSupplier: (supplierId: string) => client.delete(`/admin/suppliers/${supplierId}`),
    
    getUsers: (params?: { q?: string; showInactive?: boolean }) => client.get<{ success: boolean; data: { users: User[] } }>("/admin/users", { params }),
    convertToSupplier: (userId: string) => client.post(`/admin/users/${userId}/convert-to-supplier`),
    deleteUser: (userId: string) => client.delete(`/admin/users/${userId}`),
    
    getDashboardAnalytics: () => client.get<{ success: boolean; data: any }>("/admin/dashboard/analytics"),
};
