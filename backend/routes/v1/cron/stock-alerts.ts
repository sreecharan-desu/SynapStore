import { Router, Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { sendMail } from "../../../lib/mailer";
import { getStockAlertEmailTemplate, getSupplierClientStockAlertEmailTemplate } from "../../../lib/emailTemplates";

const cronRouter = Router();

// Load interval from env or default to 20 hours (prevent double send on daily cron, allow slight drift)
const ALERT_INTERVAL_SECONDS = parseInt(process.env.STOCK_ALERT_INTERVAL || "72000", 10);
const EXPIRY_THRESHOLD_DAYS = parseInt(process.env.STOCK_ALERT_EXPIRY_THRESHOLD_DAYS || "30", 10);
const LOW_STOCK_THRESHOLD_QTY = parseInt(process.env.STOCK_ALERT_LOW_STOCK_THRESHOLD_QTY || "15", 10);

cronRouter.get("/stock-alerts", async (req: Request, res: Response) => {
  try {
    // 1. Security Check
    // In production on Vercel, you should secure your cron routes.
    // Vercel sends a header 'Authorization: Bearer <CRON_SECRET>' if configured.
    // Or check for signature. For now, we will allow it but recommend setting CRON_SECRET.
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return res.status(401).json({ error: "Unauthorized" });
    }

    const now = new Date();
    // Calculate the threshold time for the last alert
    const lastAlertThreshold = new Date(now.getTime() - ALERT_INTERVAL_SECONDS * 1000);

    // 2. Get all active stores
    const stores = await prisma.store.findMany({
      where: { isActive: true },
      include: {
        users: {
          where: { role: "STORE_OWNER" },
          include: { user: true }
        }
      }
    });

    // 2b. Get Global Admins to BCC/Notify
    const admins = await prisma.user.findMany({
      where: {
        globalRole: { in: ["SUPERADMIN", "ADMIN"] as any } // Cast as any if Role enum strictness is an issue, or import Role
      }
    });
    const adminEmails = admins.map(a => a.email);

    const results = [];

    for (const store of stores) {
      // 3. Check if we sent an alert recently
      const lastLog = await prisma.activityLog.findFirst({
        where: {
          storeId: store.id,
          action: "STOCK_ALERT_SENT"
        },
        orderBy: { createdAt: 'desc' }
      });

      if (lastLog && lastLog.createdAt > lastAlertThreshold) {
        results.push({ store: store.name, status: "Skipped (Too soon)" });
        continue;
      }

      // 4. Check Stock Health
      // a. Expiring Soon (or expired)
      const expiryDateLimit = new Date();
      expiryDateLimit.setDate(expiryDateLimit.getDate() + EXPIRY_THRESHOLD_DAYS);

      const expiringItems = await prisma.inventoryBatch.findMany({
        where: {
          storeId: store.id,
          expiryDate: {
            lte: expiryDateLimit // Less than or equal to 30 days from now
          },
          qtyAvailable: { gt: 0 } // Only check items we actually have
        },
        include: { medicine: true },
        take: 5 // Limit to top 5 to prevent giant emails
      });

      // b. Low Stock (Aggregated by Medicine)
      // Fixes issue where empty old batches triggered low stock alerts despite having total stock
      const lowStockGroups = await prisma.inventoryBatch.groupBy({
        by: ['medicineId'],
        where: {
          storeId: store.id
        },
        _sum: {
          qtyAvailable: true
        },
        having: {
          qtyAvailable: {
            _sum: {
              lte: LOW_STOCK_THRESHOLD_QTY
            }
          }
        },
        orderBy: {
            _sum: {
                qtyAvailable: 'asc'
            }
        },
        take: 20
      });

      let lowStockItems: any[] = []; // transformed for template

      if (lowStockGroups.length > 0) {
          const medIds = lowStockGroups.map(g => g.medicineId);
          const meds = await prisma.medicine.findMany({
              where: { id: { in: medIds } },
              select: { id: true, brandName: true }
          });
          
          lowStockItems = lowStockGroups.map(g => {
              const m = meds.find(x => x.id === g.medicineId);
              return {
                  medicine: m || { brandName: 'Unknown' },
                  // For aggregated low stock, we show 'Total' instead of a batch number
                  batchNumber: 'Total Stock', 
                  qtyAvailable: g._sum.qtyAvailable || 0
              };
          });
      }

      // 5. Send Alert if needed
      if (expiringItems.length > 0 || lowStockItems.length > 0) {
        const storeOwners = store.users
            .map((u: any) => u.user.email?.toLowerCase())
            .filter((e: string | undefined) => !!e);
            
        const normalizedAdmins = adminEmails
            .map(e => e?.toLowerCase())
            .filter(e => !!e);
        
        // Combine owners and admins, unique list
        const recipients = [...new Set([...storeOwners, ...normalizedAdmins])];
        
        console.log(`
  📦 [StockAlert] Processing Store: ${store.name}
  ───────────────────────────────────────────────
  📧 Recipients: ${recipients.join(", ")}
  📉 Low Stock Items: ${lowStockItems.length}
  ⏳ Expiring Items: ${expiringItems.length}
        `);

        // Map to simpler format for template
        const mappedExpiring = expiringItems.map((i: any) => ({
            name: i.medicine.brandName,
            batch: i.batchNumber || 'N/A',
            expiryDate: i.expiryDate,
        }));

        const mappedLowStock = lowStockItems.map((i: any) => ({
            name: i.medicine.brandName,
            batch: i.batchNumber || 'N/A', // aggregated shows 'Total Stock'
            qty: i.qtyAvailable
        }));

        const emailHtml = getStockAlertEmailTemplate(store.name, mappedExpiring, mappedLowStock);

        // a. Send to Store Owners/Admins
        await Promise.all(recipients.map((email: string) => 
           sendMail({
             to: email,
             subject: `Stock Alert: ${store.name}`,
             html: emailHtml
           })
        ));

        console.log(`  ✅ Emails sent to owners/admins`);

        // b. Send to Connected Suppliers (Only for Low Stock items - Expiring is internal concern usually)
        if (mappedLowStock.length > 0) {
            const connectedSuppliers = await prisma.supplierStore.findMany({
                where: { storeId: store.id, supplier: { NOT: { userId: null } } },
                include: { supplier: { include: { user: true } } }
            });

            const uniqueSuppliers = new Map(); // Avoid duplicate emails if data issue
            connectedSuppliers.forEach(cs => {
                if (cs.supplier.user?.email && !uniqueSuppliers.has(cs.supplier.id)) {
                    uniqueSuppliers.set(cs.supplier.id, {
                        email: cs.supplier.user.email,
                        name: cs.supplier.name
                    });
                }
            });

            const supplierPromises = Array.from(uniqueSuppliers.values()).map(s => {
                const html = getSupplierClientStockAlertEmailTemplate(s.name, store.name, mappedLowStock);
                return sendMail({
                    to: s.email,
                    subject: `Client Stock Alert: ${store.name}`,
                    html
                });
            });

            await Promise.all(supplierPromises);
            console.log(`  🚚 Notified ${supplierPromises.length} suppliers`);
        }
        
        console.log(`  ───────────────────────────────────────────────\n`);

        // Log the action so we don't spam
        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            action: "STOCK_ALERT_SENT",
            payload: {
              expiringCount: expiringItems.length,
              lowStockCount: lowStockItems.length
            }
          }
        });

        results.push({ store: store.name, status: "Sent", recipients: storeOwners.length });
      } else {
        results.push({ store: store.name, status: "No alerts needed" });
      }
    }

    return res.json({ success: true, results });

  } catch (error) {
    console.error("Cron Job Error:", error);
    return res.status(500).json({ 
        success: false, 
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default cronRouter;
