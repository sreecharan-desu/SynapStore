/* backend/utils/receipt_generator.ts - Refined "Clean & Neat" Template (Green) */
import PDFDocument from "pdfkit";
import { decryptCell, dekFromEnv } from "../middleware/prisma_crypto_middleware";
import axios from "axios";

// --- Decryption Helpers (Shared) ---
let _dek: Buffer;
const getDek = () => {
  if (!_dek) _dek = dekFromEnv();
  return _dek;
};

const decryptUser = (user: any) => {
  if (!user) return null;
  const dek = getDek();
  try {
    return {
      ...user,
      email: user.email ? decryptCell(user.email, dek) : user.email,
      username: user.username ? decryptCell(user.username, dek) : user.username,
      // Add other fields if needed
    };
  } catch (e) {
    return user;
  }
};

// Cache logo buffer to speed up subsequent requests
let logoBuffer: Buffer | null = null;
const LOGO_URL = "https://res.cloudinary.com/dzunpdnje/image/upload/v1765706720/SynapStore_Logo_g2tlah.png";

const fetchLogo = async () => {
    if (logoBuffer) return logoBuffer;
    try {
        const response = await axios.get(LOGO_URL, { responseType: "arraybuffer" });
        logoBuffer = Buffer.from(response.data, "binary");
        return logoBuffer;
    } catch (err) {
        console.error("Failed to fetch logo for PDF", err);
        return null;
    }
};

export const generateReceiptPDF = async (doc: PDFKit.PDFDocument, sale: any, receiptNo: string, store: any, items: any[] = []) => {
    // 1. Decrypt Data
    const cashier = decryptUser(sale.createdBy);
    
    // Use explicitly passed items (likely from snapshot) or fallback to DB relation
    const itemsToRender = (items && items.length > 0) ? items : (sale.items || []);
    
    // 2. Fetch Logo
    const logo = await fetchLogo();
    
    // ... rest of layout ...

    // --- Layout Constants ---
    const MARGIN = 40;
    const PAGE_WIDTH = 595.28; // A4 point width
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    const PRIMARY_COLOR = "#1fa463"; // Green from template
    const TEXT_COLOR = "#333333";
    const GREY_BG = "#f6f7f9";
    const WHITE = "#ffffff";
    const BORDER_COLOR = "#e0e0e0";

    // --- Background ---
    // Make entire page slightly greyish as per template? 
    // Usually PDFs are white for printing. The template has a grey body and white card.
    // We will simulate the white card look effectively.
    
    // Header Logo (Centered)
    let y = 0;
    if (logo) {
        const logoWidth = 120;
        const logoX = (PAGE_WIDTH - logoWidth) / 2;
        doc.image(logo, logoX, y, { width: logoWidth });
        y += 60; // height + spacing

        y += 50;
        doc.rect(MARGIN, y, CONTENT_WIDTH, 25).fill(GREY_BG); // Header BG
    } else {
        // Fallback text
        doc.font("Helvetica-Bold").fontSize(20).fillColor(PRIMARY_COLOR)
           .text("SynapStore", 0, y, { align: "center" });
        y += 40;
    }

    y += 10; // Add top padding for the title
    // Title
    doc.fillColor(PRIMARY_COLOR).fontSize(16).font("Helvetica-Bold")
        .text("Sales Receipt", MARGIN, y, { width: CONTENT_WIDTH, align: "center" });
    y += 40; // Original increment, now includes bottom padding implicitly

    // Greeting / Meta
    doc.fillColor(TEXT_COLOR).fontSize(10).font("Helvetica");
    
    // Center block for key details
    const leftColX = MARGIN + 40;
    const rightColX = MARGIN + 280;

    // We can group Store Info and Receipt Info
    
    // Store Name
    doc.font("Helvetica-Bold").fontSize(12).text(store.name, 0, y, { align: "center" });
    y += 20;

    doc.fontSize(10).font("Helvetica");
    doc.text(`Receipt #: ${receiptNo}`, 0, y, { align: "center" });
    y += 15;
    doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`, 0, y, { align: "center" });
    y += 15;
    if (cashier) {
        doc.text(`Cashier: ${cashier.username || "Staff"}`, 0, y, { align: "center" });
        y += 15;
    }
    if (sale.paymentMethod) {
        doc.text(`Payment Mode: ${sale.paymentMethod}`, 0, y, { align: "center" });
        y += 15;
    }

    y += 20;
    
    // --- Table ---
    const tableTop = y;
    const itemColX = MARGIN;
    const qtyColX = PAGE_WIDTH - MARGIN - 150;
    const priceColX = PAGE_WIDTH - MARGIN - 80;
    
    // Table Header
    doc.rect(itemColX, y, CONTENT_WIDTH, 25).fill("#f2f2f2"); // Header BG
    doc.fillColor(TEXT_COLOR).font("Helvetica-Bold");
    doc.text("Item / Description", itemColX + 10, y + 8);
    doc.text("Qty", qtyColX, y + 8, { width: 50, align: "center" });
    doc.text("Total", priceColX, y + 8, { align: "right", width: 80 });
    
    y += 25;

    // Table Content
    doc.font("Helvetica").fontSize(10);
    
    // Border
    doc.strokeColor(BORDER_COLOR).lineWidth(0.5);
    doc.moveTo(itemColX, tableTop).lineTo(itemColX + CONTENT_WIDTH, tableTop).stroke(); // Top border
    
    itemsToRender.forEach((item: any, index: number) => {
        // Pagination logic
        if (y > 750) {
            doc.addPage();
            y = 50;
        }
        
        // Handle different data structures (Snapshot vs DB)
        const totalVal = item.total !== undefined ? item.total : item.lineTotal;
        const itemTotal = Number(totalVal).toFixed(2);
        
        // Decrypt Medicine Name, Strength, UOM
        let itemName = item.name || item.medicine?.brandName || "Item";
        // Check top-level first (from receiptData construction), then nested medicine
        let strength = item.strength || item.medicine?.strength || "";
        let uom = item.uom || item.medicine?.uom || "";

        try {
            const dek = getDek();
            // Name: Only decrypt if it looks encrypted? 
            // Actually, for receiptItems constructed in checkout, 'name' is ALREADY decrypted.
            // But for historical receipts re-generated from DB, 'item.medicine' might be encrypted.
            // We'll optimistically try decrypting if it fails/returns null we keep original.
            
            // If item comes from Receipt 'data' JSON, it's likely plain text.
            // If item comes from Sale->SaleItem->Medicine (re-fetched), it's encrypted.
            
            // Simplest heuristic: Try decrypting. If result is null/empty because it wasn't encrypted, keep original.
            
            const decryptedName = decryptCell(itemName, dek);
            if (decryptedName) itemName = decryptedName;
            
            const decryptedStrength = decryptCell(strength, dek);
            if (decryptedStrength) strength = decryptedStrength;
            
            const decryptedUom = decryptCell(uom, dek);
            if (decryptedUom) uom = decryptedUom;

        } catch (e) {
            // ignore error, use original
        }

        // Add details if available
        const details = [strength, uom].filter(Boolean).join(" ");
        if (details) {
            itemName += ` (${details})`;
        }

        doc.fillColor(TEXT_COLOR);
        doc.text(itemName, itemColX + 10, y + 8, { width: 320, lineBreak: false, ellipsis: true });
        doc.text(item.qty.toString(), qtyColX, y + 8, { width: 50, align: "center" });
        doc.text(itemTotal, priceColX, y + 8, { align: "right", width: 80 });

        // Row Border (bottom)
        doc.moveTo(itemColX, y + 25).lineTo(itemColX + CONTENT_WIDTH, y + 25).stroke();
        
        y += 25;
    });

    y += 10;
    
    // --- Total ---
    // doc.rect(itemColX, y, CONTENT_WIDTH, 30).fill(PRIMARY_COLOR); // Optional green bar
    
    doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_COLOR);
    doc.text("Grand Total:", qtyColX - 60, y + 8);
    doc.fillColor(PRIMARY_COLOR);
    doc.text(Number(sale.totalValue).toFixed(2), priceColX, y + 8, { align: "right", width: 80 });

    y += 50;

    // --- Footer ---
    doc.fontSize(10).font("Helvetica").fillColor("#888").text("Thank you for your business!", 0, y, { align: "center" });
    
    y += 30;
    doc.lineWidth(1).strokeColor(BORDER_COLOR).moveTo(MARGIN + 100, y).lineTo(PAGE_WIDTH - MARGIN - 100, y).stroke();
    y += 10;
    doc.fontSize(8).text("©️ SynapStore — Intelligent Pharmacy Management", 0, y, { align: "center" });

    doc.end();
};

