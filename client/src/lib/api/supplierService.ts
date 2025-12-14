import axios from 'axios';
import type { SupplierUploadResponse, UploadSupplierParams } from '../types';

// Configure your base URL here
const API_BASE_URL = 'https://anandvelpuri-zenith.hf.space'; // Derived from Links [cite: 41]

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    // Note: Do not set default Content-Type here to avoid conflicts with FormData or other types
});

export const SupplierService = {
    /**
     * Endpoint: GET /templates/supplier-upload
     * Description: Download Supplier Upload Template
     * Source: PDF Page 1 [cite: 10]
     */
    downloadTemplate: async (): Promise<void> => {
        try {
            // Explicitly request a blob and type the response
            const response = await apiClient.get<Blob>('/templates/supplier-upload', {
                responseType: 'blob',
            });

            // response.data is strongly typed as Blob now
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'supplier_template.csv');
            document.body.appendChild(link);
            link.click();

            // Cleanup with a small delay to ensure the download triggers
            setTimeout(() => {
                link.remove();
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error('Error downloading template:', error);
            throw error;
        }
    },

    /**
     * Endpoint: POST /supplier/upload
     * Description: Upload supplier file with store_slug and supplier_id
     * Source: PDF Page 1 [cite: 24, 28, 31, 38]
     */
    uploadFile: async ({
        storeSlug,
        supplierId,
        file,
    }: UploadSupplierParams): Promise<SupplierUploadResponse> => {
        const formData = new FormData();
        formData.append('file', file);

        // Construct query parameters
        const params = new URLSearchParams();
        params.append('store_slug', storeSlug);
        if (supplierId) {
            params.append('supplier_id', supplierId);
        }

        const response = await apiClient.post<SupplierUploadResponse>(
            `/supplier/upload`,
            formData,
            {
                params: params,
                // Let Axios set the Content-Type to multipart/form-data with the correct boundary
            }
        );
        return response.data;
    },

    /**
     * Endpoint: GET /supplier/upload/{upload_id}/status
     * Description: Check the status of an upload
     * Source: PDF Page 2 [cite: 80, 85]
     */
    getUploadStatus: async (uploadId: string): Promise<string> => {
        const response = await apiClient.get<string>(
            `/supplier/upload/${uploadId}/status`
        );
        return response.data;
    },
};
