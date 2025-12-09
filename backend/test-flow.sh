#!/bin/bash

# SynapStore End-to-End Test Script
# strict mode
set -e

API_URL="http://localhost:3000/api/v1"
EMAIL_PREFIX="testuser_$(date +%s)_$RANDOM"
OWNER_EMAIL="${EMAIL_PREFIX}_owner@example.com"
SUPPLIER_EMAIL="${EMAIL_PREFIX}_supp@example.com"
PASSWORD="password123"

echo "=== SynapStore Backup E2E Flow ==="
echo "Target: $API_URL"

# Helper to extract json field
json_val() {
  echo "$1" | jq -r "$2"
}

# 1. Register Store Owner
echo ""
echo "[1] Registering Store Owner: $OWNER_EMAIL"
REG_RES=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"OwnerUser\", \"email\": \"$OWNER_EMAIL\", \"password\": \"$PASSWORD\"}")
echo "Response: $REG_RES"
OWNER_ID=$(echo "$REG_RES" | jq -r '.user.id')

# 2. Verify OTP
echo "[*] Fetching OTP from DB for User ID: $OWNER_ID..."
OTP=$(npx ts-node -e "import prisma from './lib/prisma'; prisma.otp.findFirst({where:{userId: '$OWNER_ID'}, orderBy:{createdAt:'desc'}}).then(o => { if(o) console.log(require('./lib/crypto').crypto$.decryptCell(o.otpHash)) })")
echo "Got OTP: $OTP"

echo "[2] Verifying OTP..."
VERIFY_RES=$(curl -s -X POST "$API_URL/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$OWNER_EMAIL\", \"otp\": \"$OTP\"}")
echo "Response: $VERIFY_RES"

# 3. Signin Store Owner
echo "[3] Signing in Store Owner..."
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$OWNER_EMAIL\", \"password\": \"$PASSWORD\"}")
echo $LOGIN_RES > login_owner.json
OWNER_TOKEN=$(cat login_owner.json | jq -r '.token')
echo "Token: $OWNER_TOKEN"

# 4. Create Store
echo "[4] Creating Store..."
STORE_RES=$(curl -s -X POST "$API_URL/store/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"name\": \"Test Store\", \"slug\": \"store_$(date +%s)\", \"currency\": \"USD\"}")
echo $STORE_RES > store.json
STORE_ID=$(cat store.json | jq -r '.effectiveStore.id')
echo "Store ID: $STORE_ID"

# 5. Register Supplier User
echo ""
echo "[5] Registering Supplier User: $SUPPLIER_EMAIL"
S_REG_RES=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"SupplierUser\", \"email\": \"$SUPPLIER_EMAIL\", \"password\": \"$PASSWORD\"}")
SUPP_ID_USER=$(echo "$S_REG_RES" | jq -r '.user.id')

echo "[*] Fetching OTP for Supplier User ID: $SUPP_ID_USER..."
S_OTP=$(npx ts-node -e "import prisma from './lib/prisma'; prisma.otp.findFirst({where:{userId: '$SUPP_ID_USER'}, orderBy:{createdAt:'desc'}}).then(o => { if (o) console.log(require('./lib/crypto').crypto$.decryptCell(o.otpHash)) })")

echo "[6] Verifying Supplier OTP..."
curl -s -X POST "$API_URL/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$SUPPLIER_EMAIL\", \"otp\": \"$S_OTP\"}" > /dev/null

echo "[7] Signing in Supplier..."
S_LOGIN_RES=$(curl -s -X POST "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$SUPPLIER_EMAIL\", \"password\": \"$PASSWORD\"}")
echo $S_LOGIN_RES > login_supplier.json
SUPP_TOKEN=$(cat login_supplier.json | jq -r '.token')
echo "Supplier Token: $SUPP_TOKEN"

# 6. Create Global Supplier Profile
echo "[8] Creating Global Supplier Profile..."
G_SUPP_RES=$(curl -s -X POST "$API_URL/suppliers/global" \
  -H "Authorization: Bearer $SUPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Global Mega Supplier\", \"contactName\": \"John Doe\"}")
echo $G_SUPP_RES > supplier.json
SUPP_ID=$(cat supplier.json | jq -r '.data.supplier.id')
echo "Supplier ID: $SUPP_ID"

# 7. Request Access to Store
echo "[9] Requesting access to Store $STORE_ID..."
REQ_RES=$(curl -s -X POST "$API_URL/supplier-requests" \
  -H "Authorization: Bearer $SUPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"storeId\": \"$STORE_ID\", \"supplierId\": \"$SUPP_ID\", \"message\": \"Let me supply you\"}")
echo $REQ_RES > request.json
REQ_ID=$(cat request.json | jq -r '.data.request.id')
echo "Request ID: $REQ_ID"

# 8. Accept Request (as Owner)
echo "[10] Accepting Request (as Owner)..."
ACCEPT_RES=$(curl -s -X POST "$API_URL/supplier-requests/$REQ_ID/accept" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID")
echo "Response: $ACCEPT_RES"

# 9. Inventory Upload
# 9. Inventory Upload Init (ML Flow)
echo "[11] Initiating Inventory Upload (ML Flow)..."
UPLOAD_RES=$(curl -s -X POST "$API_URL/inventory/upload-init" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID" \
  -H "Content-Type: application/json" \
  -d "{\"filename\": \"test_inventory.xlsx\"}")
echo $UPLOAD_RES > upload.json
UPLOAD_ID=$(cat upload.json | jq -r '.uploadId')
echo "Upload ID: $UPLOAD_ID"

echo "[12] Checking Upload Status..."
STATUS_RES=$(curl -s -X GET "$API_URL/inventory/upload/$UPLOAD_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID")
echo "Status: $(echo $STATUS_RES | jq -r '.status')"

# Seed Inventory for Sales Test
echo "[*] Seeding Medicine and Inventory via DB for Sales Test..."
MED_ID=$(npx ts-node -e "
  import prisma from './lib/prisma';
  async function seed() {
    // Create Medicine
    const med = await prisma.medicine.create({
      data: {
        storeId: '$STORE_ID',
        brandName: 'Test Paracetamol',
        sku: 'TEST-SKU-001'
      }
    });
    // Create Batch
    await prisma.inventoryBatch.create({
      data: {
        storeId: '$STORE_ID',
        medicineId: med.id,
        batchNumber: 'BATCH-001',
        qtyAvailable: 100,
        qtyReceived: 100
      }
    });
    console.log(med.id);
  }
  seed().catch(console.error);
")
echo "Medicine ID: $MED_ID"

# 10. Create Sale
echo "[13] Creating Sale..."
SALE_RES=$(curl -s -X POST "$API_URL/sales" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID" \
  -H "Content-Type: application/json" \
  -d "{\"items\": [{\"medicineId\": \"$MED_ID\", \"qty\": 1, \"unitPrice\": 10}]}")
echo $SALE_RES > sale.json
SALE_ID=$(cat sale.json | jq -r '.sale.id')
echo "Sale ID: $SALE_ID"

# 11. Pay Sale
echo "[14] Paying Sale..."
PAY_RES=$(curl -s -X POST "$API_URL/sales/$SALE_ID/pay" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID" \
  -H "Content-Type: application/json" \
  -d "{\"paymentMethod\": \"CASH\"}")
echo "Response: $PAY_RES"

# 12. Receipt
echo "[15] Getting Receipt..."
curl -s -X GET "$API_URL/sales/$SALE_ID/receipt" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID" > receipt.html
echo "Receipt saved to receipt.html"

echo "Receipt saved to receipt.html"

# 13. Check Notifications (Store Owner)
echo ""
echo "[16] Checking Store Owner Notifications (expect Supplier Request)..."
NOTIF_RES=$(curl -s -X GET "$API_URL/notifications" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "x-store-id: $STORE_ID")
echo "Notifications: $(echo $NOTIF_RES | jq -c '.rows[] | {subject: .subject, channel: .channel} ')"

# 14. Check Notifications (Supplier)
echo ""
echo "[17] Checking Supplier Notifications (expect Accepted)..."
S_NOTIF_RES=$(curl -s -X GET "$API_URL/notifications" \
  -H "Authorization: Bearer $SUPP_TOKEN")
echo "Notifications: $(echo $S_NOTIF_RES | jq -c '.rows[] | {subject: .subject, channel: .channel} ')"

# 15. Create and Verify Superadmin
ADMIN_EMAIL="${EMAIL_PREFIX}_admin@example.com"
echo ""
echo "[18] Creating Superadmin User: $ADMIN_EMAIL"
AREG_RES=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"SuperAdmin\", \"email\": \"$ADMIN_EMAIL\", \"password\": \"$PASSWORD\"}")
ADMIN_ID=$(echo "$AREG_RES" | jq -r '.user.id')

echo "[*] Fetching OTP for Admin User..."
A_OTP=$(npx ts-node -e "import prisma from './lib/prisma'; prisma.otp.findFirst({where:{userId: '$ADMIN_ID'}, orderBy:{createdAt:'desc'}}).then(o => { if (o) console.log(require('./lib/crypto').crypto$.decryptCell(o.otpHash)) })")

curl -s -X POST "$API_URL/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"otp\": \"$A_OTP\"}" > /dev/null

echo "[*] Upgrading User to SUPERADMIN via DB..."
npx ts-node -e "import prisma from './lib/prisma'; prisma.user.update({where: {id: '$ADMIN_ID'}, data: {globalRole: 'SUPERADMIN'}}).then(() => console.log('Upgraded'))"

echo "[19] Signing in Superadmin..."
ALOGIN_RES=$(curl -s -X POST "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$PASSWORD\"}")
echo $ALOGIN_RES > login_admin.json
ADMIN_TOKEN=$(cat login_admin.json | jq -r '.token')
echo "Admin Token: $ADMIN_TOKEN"

# 16. Admin Actions
echo ""
echo "[20] Admin: List Stores..."
STORES_LIST=$(curl -s -X GET "$API_URL/admin/stores" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Stores Count: $(echo $STORES_LIST | jq '.data.stores | length')"

echo "[21] Admin: List Suppliers..."
SUPPS_LIST=$(curl -s -X GET "$API_URL/admin/suppliers" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Suppliers Count: $(echo $SUPPS_LIST | jq '.data.suppliers | length')"

echo "[22] Admin: Suspend Store $STORE_ID..."
SUSPEND_RES=$(curl -s -X PATCH "$API_URL/admin/stores/$STORE_ID/suspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"isActive\": false}")
echo "Suspended Status: $(echo $SUSPEND_RES | jq '.data.store.isActive')"

echo "[23] Admin: Stats..."
STATS_RES=$(curl -s -X GET "$API_URL/admin/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "Stats: $(echo $STATS_RES | jq -c '.data.counts')"

echo "=== Test Complete ==="
