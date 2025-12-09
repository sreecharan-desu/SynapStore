import { useState, useEffect } from "react";
import { inventoryApi, salesApi } from "../../lib/api/endpoints";
import type { Medicine, Sale } from "../../lib/types";
import { Search, ShoppingCart, Trash2, Plus, Minus } from "lucide-react";

type CartItem = {
    medicine: Medicine;
    qty: number;
};

const SalesPage = () => {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastSale, setLastSale] = useState<Sale | null>(null);

    useEffect(() => {
        // Load meds for POS search
        inventoryApi.listMedicines().then(setMedicines);
    }, []);

    const addToCart = (med: Medicine) => {
        setCart(prev => {
            const existing = prev.find(i => i.medicine.id === med.id);
            if (existing) {
                return prev.map(i => i.medicine.id === med.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { medicine: med, qty: 1 }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.medicine.id === id) {
                return { ...i, qty: Math.max(1, i.qty + delta) };
            }
            return i;
        }));
    };

    const removeItem = (id: string) => {
        setCart(prev => prev.filter(i => i.medicine.id !== id));
    };

    const total = cart.reduce((acc, item) => acc + (item.medicine.price || 0) * item.qty, 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            const payload = {
                items: cart.map(i => ({
                    medicineId: i.medicine.id,
                    qty: i.qty,
                    unitPrice: i.medicine.price
                })),
                paymentMethod: "CASH",
            };
            const res = await salesApi.create(payload);
            setLastSale(res.data.sale);
            setCart([]);
            // Auto pay?
            await salesApi.pay(res.data.sale.id, { paymentMethod: "CASH" });
        } catch (e) {
            console.error(e);
            alert("Sale failed (Backend may require real inventory batches which are missing in this mock setup, or stock is insufficient).");
        } finally {
            setLoading(false);
        }
    };

    const filteredMeds = medicines.filter(m =>
        m.brandName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-6">
            {/* Left Catalog */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 flex gap-3">
                    <Search className="text-slate-400" />
                    <input
                        className="flex-1 outline-none text-slate-700"
                        placeholder="Search products..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-4 content-start">
                    {filteredMeds.map(med => (
                        <button
                            key={med.id}
                            onClick={() => addToCart(med)}
                            className="flex flex-col items-start p-4 border border-slate-100 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all text-left group"
                        >
                            <div className="font-semibold text-slate-800">{med.brandName}</div>
                            <div className="text-sm text-slate-500">{med.sku || "Generic"}</div>
                            <div className="mt-2 text-emerald-600 font-bold group-hover:scale-105 transition-transform">₹{med.price ?? 0}</div>
                        </button>
                    ))}
                    {filteredMeds.length === 0 && (
                        <div className="col-span-full text-center text-slate-400 py-10">
                            No products found. Add them in Inventory.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Cart */}
            <div className="w-96 flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 bg-slate-800 border-b border-slate-700">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShoppingCart className="text-emerald-400" /> Current Sale
                    </h2>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3">
                    {cart.map(item => (
                        <div key={item.medicine.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <div className="flex-1">
                                <div className="font-medium">{item.medicine.brandName}</div>
                                <div className="text-sm text-slate-400">₹{item.medicine.price} x {item.qty}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
                                    <button onClick={() => updateQty(item.medicine.id, -1)} className="p-1 hover:bg-slate-600 rounded"><Minus size={14} /></button>
                                    <span className="text-sm w-4 text-center">{item.qty}</span>
                                    <button onClick={() => updateQty(item.medicine.id, 1)} className="p-1 hover:bg-slate-600 rounded"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => removeItem(item.medicine.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="text-center text-slate-500 py-10 italic">
                            Cart is empty
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-800 border-t border-slate-700 space-y-4">
                    <div className="flex justify-between text-lg">
                        <span className="text-slate-400">Total</span>
                        <span className="font-bold text-2xl text-emerald-400">₹{total.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || loading}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        {loading ? "Processing..." : "Complete Sale"}
                    </button>
                </div>
            </div>

            {/* Receipt Modal (Simple alert for now or inline) */}
            {lastSale && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white text-slate-900 p-8 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingCart size={32} />
                        </div>
                        <h3 className="text-2xl font-bold">Sale Completed!</h3>
                        <p className="text-slate-600">Total: ₹{lastSale.totalValue}</p>
                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <button onClick={() => setLastSale(null)} className="py-2 border rounded-lg hover:bg-slate-50">Close</button>
                            <button className="py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Print Receipt</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesPage;
