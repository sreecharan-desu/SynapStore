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
    try {
        const responseData = req.body || {};
        const txnid = responseData.txnid || "unknown";
        
        console.log(`PayU Success Callback received for TXN: ${txnid}`);
        
        // Verify hash integrity
        const verification = payuService.verifyPaymentResponse(responseData);
        
        // Fallback URL logic
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const frontendSuccessUrl = `${frontendBase}/payment/success`;
        const frontendFailureUrl = `${frontendBase}/payment/failure`;

        let redirectUrl = `${frontendFailureUrl}?txnid=${txnid}&error=verification_failed`;

        if (verification.isValid && (verification.status === 'success' || responseData.status === 'success')) {
            try {
                if (verification.orderId) {
                    // Update the Sale record in the database
                    await prisma.sale.update({
                        where: { id: verification.orderId },
                        data: { paymentStatus: 'PAID' }
                    });
                    console.log(`Sale ${verification.orderId} marked as PAID. Verification valid.`);
                    redirectUrl = `${frontendSuccessUrl}?txnid=${txnid}`;
                } else {
                    console.error("Order ID missing in PayU response");
                    redirectUrl = `${frontendFailureUrl}?txnid=${txnid}&error=missing_order_id`;
                }
            } catch (dbError) {
                console.error(`Failed to update DB for Sale ${verification.orderId}:`, dbError);
                redirectUrl = `${frontendFailureUrl}?txnid=${txnid}&error=db_update_failed`;
            }
        } else {
            console.warn(`PayU Hash Verification failed for TXN: ${txnid}. Expected SUCCESS but got ${verification.status || responseData.status}`);
            redirectUrl = `${frontendFailureUrl}?txnid=${txnid}&error=hash_mismatch`;
        }

        console.log(`Redirecting user to: ${redirectUrl}`);
        return res.redirect(redirectUrl);
    } catch (error) {
        console.error("Critical error in payment success callback:", error);
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendBase}/payment/failure?error=internal_callback_error`);
    }
});

// 3. Failure Callback (POST from PayU)
router.post('/callback/failure', async (req: Request, res: Response) => {
    try {
        const responseData = req.body || {};
        console.log(`PayU Failure Callback received for TXN: ${responseData.txnid}`);

        try {
            // udf1 contains our internal saleId
            const saleId = responseData.udf1;
            if (saleId) {
                await prisma.sale.update({
                    where: { id: saleId },
                    data: { paymentStatus: 'FAILED' }
                });
                console.log(`Sale ${saleId} marked as FAILED in database.`);
            }
        } catch (dbError) {
            console.error(`Database update failed for failed transaction ${responseData.txnid}:`, dbError);
        }

        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const frontendFailureUrl = `${frontendBase}/payment/failure`;
        const errorMsg = responseData.error_Message || responseData.field9 || "Payment Failed";
        
        const finalRedirect = `${frontendFailureUrl}?txnid=${responseData.txnid || 'unknown'}&error=${encodeURIComponent(errorMsg)}`;
        
        console.log(`Redirecting user to failure page: ${finalRedirect}`);
        return res.redirect(finalRedirect);
    } catch (error) {
        console.error("Critical error in payment failure callback:", error);
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendBase}/payment/failure?error=internal_callback_error`);
    }
});

export default router;
