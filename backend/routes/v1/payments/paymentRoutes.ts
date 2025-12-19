import { Router, Response, Request } from 'express';
import payuService from '../../../lib/payu';
import { sendError, sendSuccess } from '../../../lib/api';
import { authenticate } from '../../../middleware/authenticate';
import prisma from '../../../lib/prisma';

const router = Router();

// 1. Initiate Payment Endpoint
router.post('/initiate', authenticate, async (req: any, res: Response) => {
    try {
        const { amount, email, name, phone, orderId } = req.body;
        
        if (!amount || !email || !name || !phone || !orderId) {
            return sendError(res, "Missing required fields", 400);
        }

        const paymentData = payuService.createPaymentRequest({
            amount, email, name, phone, orderId
        });
        
        return sendSuccess(res, "Payment initiated", paymentData);
    } catch (error: any) {
        return sendError(res, error.message, 500);
    }
});

// 2. Success Callback (POST from PayU)
router.post('/callback/success', async (req: Request, res: Response) => {
    // PayU sends data as x-www-form-urlencoded
    const responseData = req.body;
    
    console.log(`PayU Success Callback received for TXN: ${responseData.txnid}`);
    
    const verification = payuService.verifyPaymentResponse(responseData);
    
    const frontendSuccessUrl = `${process.env.FRONTEND_URL}/payment/success`;
    const frontendFailureUrl = `${process.env.FRONTEND_URL}/payment/failure`;

    let redirectUrl = `${frontendFailureUrl}?txnid=${responseData.txnid}&error=tampered`;

    if (verification.isValid && verification.status === 'success') {
        try {
            // Update the Sale record in the database
            await prisma.sale.update({
                where: { id: verification.orderId },
                data: { paymentStatus: 'PAID' }
            });

            console.log(`Sale ${verification.orderId} marked as PAID`);
            redirectUrl = `${frontendSuccessUrl}?txnid=${responseData.txnid}`;
        } catch (dbError) {
            console.error(`Failed to update sale ${verification.orderId}:`, dbError);
            redirectUrl = `${frontendFailureUrl}?txnid=${responseData.txnid}&error=db_update_failed`;
        }
    }

    // Return HTML to redirect the user's browser back to the React App
    const htmlContent = `
    <html>
        <head><title>Redirecting...</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;">
            <div style="text-align: center;">
                <h2>Payment Processed</h2>
                <p>Redirecting back to SynapStore...</p>
                <script>
                    setTimeout(() => {
                        window.location.replace("${redirectUrl}");
                    }, 1500);
                </script>
            </div>
        </body>
    </html>
    `;
    res.send(htmlContent);
});

// 3. Failure Callback (POST from PayU)
router.post('/callback/failure', async (req: Request, res: Response) => {
    const responseData = req.body;
    console.log(`PayU Failure Callback received for TXN: ${responseData.txnid}`);

    try {
        // Update the Sale record as FAILED. Note: udf1 contains our internal saleId
        const saleId = responseData.udf1;
        if (saleId) {
            await prisma.sale.update({
                where: { id: saleId },
                data: { paymentStatus: 'FAILED' }
            });
            console.log(`Sale ${saleId} marked as FAILED`);
        } else {
            console.warn(`No udf1 (saleId) found in failure callback for txnid: ${responseData.txnid}`);
        }
    } catch (dbError) {
        console.error(`Failed to update sale status for txnid ${responseData.txnid}:`, dbError);
    }

    const frontendFailureUrl = `${process.env.FRONTEND_URL}/payment/failure`;
    const errorMsg = responseData.error_Message || "Payment Failed";
    const redirectUrl = `${frontendFailureUrl}?txnid=${responseData.txnid}&error=${encodeURIComponent(errorMsg)}`;

    const htmlContent = `
    <html>
        <head><title>Redirecting...</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;">
            <div style="text-align: center;">
                <h2>Payment Failed</h2>
                <p>Redirecting back to SynapStore...</p>
                <script>
                    setTimeout(() => {
                        window.location.replace("${redirectUrl}");
                    }, 1500);
                </script>
            </div>
        </body>
    </html>
    `;
    res.send(htmlContent);
});

export default router;
