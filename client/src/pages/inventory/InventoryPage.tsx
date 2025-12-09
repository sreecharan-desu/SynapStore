import { useState, useEffect } from "react";
import { inventoryApi } from "../../lib/api/endpoints";
import type { Medicine, InventoryBatch } from "../../lib/types";
import { Plus, Search } from "lucide-react";

const InventoryPage = () => {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [batches, setBatches] = useState<InventoryBatch[]>([]);
    const [loading, setLoading] = useState(false);

    // Mock adding state
    const [showAddMed, setShowAddMed] = useState(false);
    const [newMedName, setNewMedName] = useState("");
    const [newMedPrice, setNewMedPrice] = useState("0");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [m, b] = await Promise.all([
                inventoryApi.listMedicines(),
                inventoryApi.listBatches()
            ]);
            setMedicines(m);
            setBatches(b);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMed = async () => {
        if (!newMedName) return;
        await inventoryApi.createMedicine({
            brandName: newMedName,
            price: Number(newMedPrice)
        });
        setShowAddMed(false);
        setNewMedName("");
        setNewMedPrice("0");
        loadData();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">
                        Bulk Upload
                    </button>
                    <button
                        onClick={() => setShowAddMed(true)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Add Medicine
                    </button>
                </div>
            </div>

            {showAddMed && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 max-w-md">
                    <h3 className="font-semibold">Add New Medicine (Mock)</h3>
                    <input
                        className="w-full border p-2 rounded"
                        placeholder="Medicine Name"
                        value={newMedName}
                        onChange={e => setNewMedName(e.target.value)}
                    />
                    <input
                        className="w-full border p-2 rounded"
                        placeholder="Price"
                        type="number"
                        value={newMedPrice}
                        onChange={e => setNewMedPrice(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAddMed(false)} className="px-3 py-1 text-slate-500">Cancel</button>
                        <button onClick={handleCreateMed} className="px-3 py-1 bg-emerald-600 text-white rounded">Save</button>
                    </div>
                </div>
            )}

            <div className="bg-white border md:border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
                    <Search className="text-slate-400" size={20} />
                    <input
                        placeholder="Search inventory..."
                        className="bg-transparent border-none focus:outline-none flex-1"
                    />
                </div>
                <table className={`w-full text-sm text-left ${loading ? "opacity-50" : ""}`}>
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-6 py-3">Medicine</th>
                            <th className="px-6 py-3">SKU</th>
                            <th className="px-6 py-3 text-right">Stock</th>
                            <th className="px-6 py-3 text-right">Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {medicines.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    No inventory found. Add a medicine or use bulk upload.
                                </td>
                            </tr>
                        ) : (
                            medicines.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-900">{m.brandName}</td>
                                    <td className="px-6 py-3 text-slate-500">{m.sku || "—"}</td>
                                    <td className="px-6 py-3 text-right">
                                        {batches.filter(b => b.medicineId === m.id).reduce((acc, b) => acc + b.qtyAvailable, 0)}
                                    </td>
                                    <td className="px-6 py-3 text-right">₹{m.price ?? 0}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InventoryPage;
