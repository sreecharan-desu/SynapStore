
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
// import { SynapNotificationClient } from "../utils/NotificationClient"; // Will need to update client usage

const PublicStorePage = () => {
    const { slug } = useParams();
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchStore = async () => {
            try {
                // Determine API URL based on Environment
                const API_URL = import.meta.env.VITE_API_URL 
                    ? `${import.meta.env.VITE_API_URL}/api/v1` 
                    : "http://localhost:3000/api/v1";
                const res = await axios.get(`${API_URL}/public/s/${slug}`);
                if (res.data.success) {
                    setStore(res.data.data.store);
                } else {
                    setError("Store not found");
                }
            } catch (err) {
                setError("Store not found or offline");
            } finally {
                setLoading(false);
            }
        };
        fetchStore();
    }, [slug]);

 
    if (loading) return <div>Loading...</div>;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20">
            <div className="max-w-xl w-full bg-white rounded-lg shadow p-8">
                <h1 className="text-3xl font-bold mb-4">{store.name}</h1>
                <p className="text-gray-600 mb-6">Welcome to our public store page.</p>
                
                <h2 className="text-xl font-semibold mb-2">Featured Products</h2>
                <ul className="space-y-2 mb-8">
                    {store.medicines?.map((m: any) => (
                        <li key={m.id} className="border-b last:border-0 pb-2">
                            <span className="font-medium">{m.brandName || m.genericName}</span>
                            <span className="text-gray-500 text-sm ml-2">({m.dosageForm} {m.strength})</span>
                        </li>
                    ))}
                    {(!store.medicines || store.medicines.length === 0) && <p>No products listed publicly.</p>}
                </ul>

               
            </div>
        </div>
    );
};

export default PublicStorePage;
