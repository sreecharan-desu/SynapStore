import { client } from "./client";
import type { User, AuthResponse, Store, Medicine, InventoryBatch, Sale, Supplier, MockMedicineCreate, MockBatchCreate } from "../types";


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
};

// --- Inventory (Real + Mock) ---
// Keys for mock storage
const MOCK_MEDICINES_KEY = "mock:medicines";
const MOCK_BATCHES_KEY = "mock:batches";

const getMockMedicines = (): Medicine[] => {
    const s = localStorage.getItem(MOCK_MEDICINES_KEY);
    return s ? JSON.parse(s) : [];
};
const saveMockMedicines = (list: Medicine[]) => localStorage.setItem(MOCK_MEDICINES_KEY, JSON.stringify(list));

const getMockBatches = (): InventoryBatch[] => {
    const s = localStorage.getItem(MOCK_BATCHES_KEY);
    return s ? JSON.parse(s) : [];
};
const saveMockBatches = (list: InventoryBatch[]) => localStorage.setItem(MOCK_BATCHES_KEY, JSON.stringify(list));

export const inventoryApi = {
    // Real endpoints for upload
    initUpload: (data: { filename?: string; metadata?: any }) =>
        client.post("/inventory/upload-init", data),

    getUpload: (id: string) => client.get(`/inventory/upload/${id}`),

    // Mocked CRUD for Medicines
    listMedicines: async (): Promise<Medicine[]> => {
        // If backend provided a list, we would use: client.get("/medicines")
        // Since it doesn't, we use mock + merge with any we can find from dashboard?
        // For now, purely mock for consistency.
        return Promise.resolve(getMockMedicines());
    },

    createMedicine: async (data: MockMedicineCreate): Promise<Medicine> => {
        const list = getMockMedicines();
        const newMed: Medicine = {
            id: crypto.randomUUID(),
            isActive: true,
            ...data
        };
        list.push(newMed);
        saveMockMedicines(list);
        return Promise.resolve(newMed);
    },

    // Mocked CRUD for Batches
    listBatches: async (): Promise<InventoryBatch[]> => {
        return Promise.resolve(getMockBatches());
    },

    createBatch: async (data: MockBatchCreate): Promise<InventoryBatch> => {
        const list = getMockBatches();
        const newBatch: InventoryBatch = {
            id: crypto.randomUUID(),
            medicineId: data.medicineId,
            batchNumber: data.batchNumber,
            qtyAvailable: data.qty,
            expiryDate: data.expiry,
            receivedAt: new Date().toISOString(),
        };
        list.push(newBatch);
        saveMockBatches(list);
        return Promise.resolve(newBatch);
    }
};

// --- Sales ---
export const salesApi = {
    create: (data: { items: any[]; paymentMethod?: string; discounts?: number; tax?: number }) =>
        client.post<{ success: boolean; sale: Sale }>("/sales", data),

    pay: (id: string, data: { paymentMethod?: string; externalRef?: string }) =>
        client.post<{ success: boolean; sale: Sale }>(`/sales/${id}/pay`, data),

    getReceipt: (id: string) => client.get<string>(`/sales/${id}/receipt`),
};

// --- Suppliers ---
export const suppliersApi = {
    listGlobal: (q?: string) => client.get<{ success: boolean; data: { suppliers: Supplier[] } }>("/suppliers-requests/global", { params: { q } }),
    createGlobal: (data: Partial<Supplier>) => client.post<{ success: boolean; data: { supplier: Supplier } }>("/suppliers-requests/global", data),
};
