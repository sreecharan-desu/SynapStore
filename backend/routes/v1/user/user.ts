
import { Router } from "express";
import { authenticate } from "../../../middleware/authenticate";
import { EntityManager } from "../../../lib/entity-manager";
import { sendSuccess, sendError, sendInternalError } from "../../../lib/api";
import prisma from "../../../lib/prisma";

const userRouter = Router();

/**
 * DELETE /v1/user/me
 * Description: Permanently deletes the authenticated user's account and personal data.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 400: Unable to delete (e.g. sole owner of active store with other users?)
 *  - 500: Internal server error
 */
userRouter.delete("/me", authenticate, async (req: any, res) => {
  try {
    const userId = req.user!.id;

    // Check if user is a sole owner of any store that has other users?
    // The requirement says: "Delete store if no other owners exist".
    // EntityManager logic handles this: checks for other owners.
    // If no other owners, it deletes the store.
    // This is "Nuclear" - deletes everything.
    
    // Warn user? Frontend should handle "Are you sure?"
    // Backend just executes.

    await prisma.$transaction(async (tx:any) => {
        // We cast tx to any because EntityManager expects a Client type which is compatible structurally
        await EntityManager.deleteUser(userId, tx as any);

        // Audit this self-deletion
        // (Though user is gone, we might want to keep a system log? But we delete the user...)
        // AuditLog userId refers to User. If User is deleted, setNull usually.
        await tx.auditLog.create({
            data: {
                actorId: null, // User is gone
                actorType: "SYSTEM", // Or USER but ID is gone
                action: "SELF_DELETION",
                resource: "User",
                resourceId: userId, // ID of deleted user
                payload: { reason: "Self service deletion" }
            }
        });
    }, { timeout: 10000 });

    return sendSuccess(res, "Account deleted successfully");

  } catch (err: any) {
    return sendInternalError(res, err);
  }
});

export default userRouter;
