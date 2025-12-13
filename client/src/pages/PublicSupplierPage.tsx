
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const PublicSupplierPage = () => {
    const { slug } = useParams();
    const [supplier, setSupplier] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchSupplier = async () => {
            try {
                const API_URL = `${import.meta.env.VITE_API_URL}/api/v1` || "http://localhost:3000/v1";
                const res = await axios.get(`${API_URL}/public/sp/${slug}`);
                if (res.data.success) {
                    setSupplier(res.data.data.supplier);
                } else {
                    setError("Supplier not found");
                }
            } catch (err) {
                setError("Supplier not found or offline");
            } finally {
                setLoading(false);
            }
        };
        fetchSupplier();
    }, [slug]);

    

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20">
            <div className="max-w-xl w-full bg-white rounded-lg shadow p-8">
                <h1 className="text-3xl font-bold mb-4">{supplier.name}</h1>
                <p className="text-gray-600 mb-6 font-mono text-sm">@{supplier.slug}</p>
                
                <h2 className="text-xl font-semibold mb-2">Details</h2>
                <div className="mb-6">
                    <p><strong>Contact:</strong> {supplier.contactName || "N/A"}</p>
                    <p><strong>Address:</strong> {supplier.address || "N/A"}</p>
                </div>

                <h2 className="text-xl font-semibold mb-2">Catalog Preview</h2>
                 <ul className="space-y-2 mb-8">
                    {supplier.medicines?.map((m: any) => (
                        <li key={m.id} className="border-b last:border-0 pb-2">
                            <span className="font-medium">{m.brandName || m.genericName}</span>
                        </li>
                    ))}
                    {(!supplier.medicines || supplier.medicines.length === 0) && <p>No products listed publicly.</p>}
                </ul>

            </div>
        </div>
    );
};

export default PublicSupplierPage;
