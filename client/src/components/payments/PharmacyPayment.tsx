import React, { useState } from 'react';
import { paymentApi } from '../../lib/api/endpoints';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';

interface PharmacyPaymentProps {
    amount: number;
    email: string;
    name: string;
    phone: string;
    orderId: string;
    onSuccess?: () => void;
    onFailure?: (error: string) => void;
}

const PharmacyPayment: React.FC<PharmacyPaymentProps> = ({
    amount,
    email,
    name,
    phone,
    orderId,
}) => {
    const [loading, setLoading] = useState(false);

    const handlePayment = async () => {
        setLoading(true);
        try {
            // 1. Get the hash and payment params from your backend
            const response = await paymentApi.initiate({
                amount,
                email,
                name,
                phone,
                orderId
            });

            if (response.data.success) {
                const payuData = response.data.data;

                // 2. Create a form dynamically and submit it to PayU
                const form = document.createElement("form");
                form.method = "POST";
                form.action = payuData.action_url; // https://secure.payu.in/_payment

                // All fields required by PayU
                const fields = [
                    'key', 'txnid', 'amount', 'productinfo', 
                    'firstname', 'email', 'phone', 'surl', 
                    'furl', 'hash', 'udf1', 'udf2', 'udf3', 
                    'udf4', 'udf5'
                ];

                fields.forEach(field => {
                    const input = document.createElement("input");
                    input.type = "hidden";
                    input.name = field;
                    input.value = payuData[field];
                    form.appendChild(input);
                });

                document.body.appendChild(form);
                form.submit();
                // User is now redirected to PayU...
            } else {
                throw new Error("Failed to initiate payment");
            }

        } catch (error: any) {
            console.error("Payment initiation failed", error);
            alert("Something went wrong initializing payment. Please try again.");
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto overflow-hidden border-zinc-800 bg-zinc-950/50 backdrop-blur-xl">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold tracking-tight text-white">Pharmacy Checkout</CardTitle>
                <CardDescription className="text-zinc-400">
                    Complete your transaction securely via PayU
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <span className="text-zinc-400">Total Amount</span>
                    <span className="text-xl font-bold text-white">₹{amount.toFixed(2)}</span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Order ID:</span>
                        <span className="text-zinc-300">{orderId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Customer:</span>
                        <span className="text-zinc-300">{name}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button 
                    onClick={handlePayment} 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-medium transition-all"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Redirecting to PayU...
                        </>
                    ) : (
                        'Pay Now with PayU'
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default PharmacyPayment;
