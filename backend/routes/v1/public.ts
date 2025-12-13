
import { Router } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError, sendInternalError } from "../../lib/api";

const router = Router();

// Cache headers helper
const setPublicCache = (res: any) => {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300"); // 1 min browser, 5 min CDN
};

/**
 * GET /v1/public/s/:slug
 * Public Store Page
 */
router.get("/s/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(slug)
    const store = await prisma.store.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        // shortDescription: true, // Assuming this field exists or needs to be added? Schema didn't show it explicitly earlier, checking...
        // Checking schema passed earlier: Store has name, slug, timezone, currency, settings. No shortDescription.
        // I will return name, slug, settings (maybe public part only?).
        // For now, I will stick to safe fields.
        currency: true,
        timezone: true,
        isActive: true,
        medicines: {
          where: { isActive: true },
          take: 10,
          select: {
            id: true,
            brandName: true,
            genericName: true,
            strength: true,
            dosageForm: true,
            // price? InventoryBatch has price. Medicine doesn't have direct price.
          }
        }
      }
    });

    if (!store || !store.isActive) {
      return sendError(res, "Store not found", 404);
    }

    setPublicCache(res);
    return sendSuccess(res, "Store public info", { store });
  } catch (err) {
    return sendInternalError(res, err, "Failed to fetch store");
  }
});

/**
 * GET /v1/public/sp/:slug
 * Public Supplier Page
 */
router.get("/sp/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    // Assuming 'slug' in URL acts as an ID since Supplier model has no clean slug field
    const supplier = await prisma.supplier.findUnique({
      where: { id: slug }, // treating param as ID
      select: {
        id: true,
        name: true,
        // slug: true, // Supplier has no slug
        address: true,
        contactName: true,
        isActive: true,
        medicines: {
             where: { isActive: true },
             take: 10,
             select: {
                id: true,
                brandName: true,
                genericName: true
             }
        }
      }
    });

    if (!supplier || !supplier.isActive) {
      return sendError(res, "Supplier not found", 404);
    }

    setPublicCache(res);
    return sendSuccess(res, "Supplier public info", { supplier });
  } catch (err) {
    return sendInternalError(res, err, "Failed to fetch supplier");
  }
});

export default router;
