import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

class PayUService {
    private merchantKey: string;
    private salt: string;
    private baseUrl: string;

    constructor() {
        this.merchantKey = process.env.PAYU_MERCHANT_KEY || "";
        this.salt = process.env.PAYU_SALT || "";
        this.baseUrl = process.env.PAYU_BASE_URL || "https://secure.payu.in"; // Use "https://test.payu.in" for testing
    }

    private generateHash(data: string): string {
        return crypto.createHash('sha512').update(data).digest('hex');
    }

    createPaymentRequest({ amount, email, name, phone, orderId, productInfo = "Pharmacy Medicines" }: {
        amount: number | string;
        email: string;
        name: string;
        phone: string;
        orderId: string;
        productInfo?: string;
    }) {
        try {
            // Aligned with Python: HMS_{booking_id}_{uuid.uuid4().hex[:8]}
            // Using PX_{orderId_short}_{random} to stay under 25 chars
            const txnid = `PX_${orderId.substring(0, 8)}_${uuidv4().substring(0, 4)}`;
            const formattedAmount = `${parseFloat(amount.toString()).toFixed(2)}`; 

            const udf1 = orderId; 
            const udf2 = "PHARMACY_SALE";
            const udf3 = "";
            const udf4 = "";
            const udf5 = "";

            const cleanProductInfo = "Medicine_Purchase";

            // Hash Sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
            const hashString = [
                this.merchantKey,
                txnid,
                formattedAmount,
                cleanProductInfo,
                name || "",
                email || "",
                udf1 || "",
                udf2 || "",
                udf3 || "",
                udf4 || "",
                udf5 || "",
                "", "", "", "", "", // udf6 to udf10 placeholders
                this.salt
            ].join('|');
            
            const paymentHash = this.generateHash(hashString);

            return {
                key: this.merchantKey,
                txnid: txnid,
                amount: formattedAmount,
                productinfo: cleanProductInfo,
                firstname: name,
                email: email,
                phone: phone,
                surl: `${process.env.BACKEND_URL}/api/v1/payments/callback/success`,
                furl: `${process.env.BACKEND_URL}/api/v1/payments/callback/failure`,
                hash: paymentHash,
                udf1: udf1,
                udf2: udf2,
                udf3: udf3,
                udf4: udf4,
                udf5: udf5,
                action_url: `${this.baseUrl}/_payment`
            };

        } catch (error) {
            console.error("Error creating payment request:", error);
            throw new Error("Failed to create payment request");
        }
    }

    verifyPaymentResponse(responseData: any) {
        try {
            const {
                status, txnid, amount, productinfo, firstname, email, hash: receivedHash, mihpayid,
                udf1, udf2, udf3, udf4, udf5, udf6, udf7, udf8, udf9, udf10
            } = responseData;

            // Handle potential undefined values for UDFs
            const u1 = udf1 || "";
            const u2 = udf2 || "";
            const u3 = udf3 || "";
            const u4 = udf4 || "";
            const u5 = udf5 || "";
            const u6 = udf6 || "";
            const u7 = udf7 || "";
            const u8 = udf8 || "";
            const u9 = udf9 || "";
            const u10 = udf10 || "";

            // Reverse Hash Sequence is CRITICAL:
            // salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
            const hashString = [
                this.salt,
                status || "",
                u10, u9, u8, u7, u6, u5, u4, u3, u2, u1,
                email || "",
                firstname || "",
                productinfo || "",
                amount || "",
                txnid || "",
                this.merchantKey
            ].join('|');

            const calculatedHash = this.generateHash(hashString);
            const isValid = (calculatedHash === receivedHash);

            console.log(`Hash Verification: ${isValid ? 'Valid' : 'Invalid'}`);

            return {
                isValid,
                status,
                transactionId: txnid,
                payuId: mihpayid,
                orderId: udf1, // Retreiving our internal Order ID
                amount,
                gatewayResponse: responseData
            };

        } catch (error) {
            console.error("Error verifying payment response:", error);
            return { isValid: false, status: 'failure', error: (error as Error).message };
        }
    }
}

export default new PayUService();
