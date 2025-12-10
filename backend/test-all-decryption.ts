/**
 * Comprehensive test to verify all encrypted fields are properly decrypted
 * Tests all models and their encrypted fields
 */

import prisma from './lib/prisma';

async function testAllEncryptedFields() {
    console.log('🔐 Testing All Encrypted Fields Decryption\n');

    let allPassed = true;

    // Helper to check if a value looks encrypted (Base64)
    const isEncrypted = (value: any) => {
        if (typeof value !== 'string') return false;
        return value && value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value);
    };

    try {
        // Test User model
        console.log('📝 Testing User model...');
        const user = await prisma.user.findFirst({
            select: { id: true, username: true, email: true, phone: true, imageUrl: true }
        });
        if (user) {
            const userEncrypted = [
                user.username && isEncrypted(user.username),
                user.email && isEncrypted(user.email),
                user.phone && isEncrypted(user.phone),
                user.imageUrl && isEncrypted(user.imageUrl),
            ].some(Boolean);

            if (userEncrypted) {
                console.log('   ❌ User fields still encrypted!');
                console.log('      Username:', user.username);
                console.log('      Email:', user.email);
                console.log('      Phone:', user.phone);
                allPassed = false;
            } else {
                console.log('   ✅ User fields properly decrypted');
            }
        }

        // Test Store model
        console.log('\n📝 Testing Store model...');
        const store = await prisma.store.findFirst({
            select: { id: true, name: true, slug: true }
        });
        if (store) {
            if (isEncrypted(store.name)) {
                console.log('   ❌ Store name still encrypted!');
                console.log('      Name:', store.name);
                allPassed = false;
            } else {
                console.log('   ✅ Store fields properly decrypted');
                console.log('      Name:', store.name);
            }
        }

        // Test Supplier model
        console.log('\n📝 Testing Supplier model...');
        const supplier = await prisma.supplier.findFirst({
            select: { id: true, name: true, address: true, phone: true, contactName: true }
        });
        if (supplier) {
            const supplierEncrypted = [
                supplier.name && isEncrypted(supplier.name),
                supplier.address && isEncrypted(supplier.address),
                supplier.phone && isEncrypted(supplier.phone),
                supplier.contactName && isEncrypted(supplier.contactName),
            ].some(Boolean);

            if (supplierEncrypted) {
                console.log('   ❌ Supplier fields still encrypted!');
                console.log('      Name:', supplier.name);
                console.log('      Address:', supplier.address);
                allPassed = false;
            } else {
                console.log('   ✅ Supplier fields properly decrypted');
            }
        }

        // Test Medicine model
        console.log('\n📝 Testing Medicine model...');
        const medicine = await prisma.medicine.findFirst({
            select: { id: true, brandName: true, genericName: true, dosageForm: true, strength: true, category: true }
        });
        if (medicine) {
            const medicineEncrypted = [
                medicine.brandName && isEncrypted(medicine.brandName),
                medicine.genericName && isEncrypted(medicine.genericName),
                medicine.dosageForm && isEncrypted(medicine.dosageForm),
                medicine.strength && isEncrypted(medicine.strength),
                medicine.category && isEncrypted(medicine.category),
            ].some(Boolean);

            if (medicineEncrypted) {
                console.log('   ❌ Medicine fields still encrypted!');
                console.log('      Brand Name:', medicine.brandName);
                console.log('      Generic Name:', medicine.genericName);
                allPassed = false;
            } else {
                console.log('   ✅ Medicine fields properly decrypted');
            }
        }

        // Test nested relations (UserStoreRole -> Store)
        console.log('\n📝 Testing nested relations (UserStoreRole -> Store)...');
        const userStoreRole = await prisma.userStoreRole.findFirst({
            select: {
                role: true,
                store: {
                    select: { id: true, name: true, slug: true }
                }
            }
        });
        if (userStoreRole?.store) {
            if (isEncrypted(userStoreRole.store.name)) {
                console.log('   ❌ Nested Store name still encrypted!');
                console.log('      Store Name:', userStoreRole.store.name);
                allPassed = false;
            } else {
                console.log('   ✅ Nested Store fields properly decrypted');
                console.log('      Store Name:', userStoreRole.store.name);
            }
        }

        // Test InventoryBatch model
        console.log('\n📝 Testing InventoryBatch model...');
        const batch = await prisma.inventoryBatch.findFirst({
            select: { id: true, batchNumber: true, location: true }
        });
        if (batch) {
            const batchEncrypted = [
                batch.batchNumber && isEncrypted(batch.batchNumber),
                batch.location && isEncrypted(batch.location),
            ].some(Boolean);

            if (batchEncrypted) {
                console.log('   ❌ InventoryBatch fields still encrypted!');
                console.log('      Batch Number:', batch.batchNumber);
                console.log('      Location:', batch.location);
                allPassed = false;
            } else {
                console.log('   ✅ InventoryBatch fields properly decrypted');
            }
        }

        // Test Notification model
        console.log('\n📝 Testing Notification model...');
        const notification = await prisma.notification.findFirst({
            select: { id: true, recipient: true, subject: true, body: true }
        });
        if (notification) {
            const notificationEncrypted = [
                notification.recipient && isEncrypted(notification.recipient),
                notification.subject && isEncrypted(notification.subject),
                notification.body && isEncrypted(notification.body),
            ].some(Boolean);

            if (notificationEncrypted) {
                console.log('   ❌ Notification fields still encrypted!');
                console.log('      Recipient:', notification.recipient);
                allPassed = false;
            } else {
                console.log('   ✅ Notification fields properly decrypted');
            }
        }

        // Final result
        console.log('\n' + '='.repeat(50));
        if (allPassed) {
            console.log('✅ ALL TESTS PASSED!');
            console.log('All encrypted fields are properly decrypted when read.');
        } else {
            console.log('❌ SOME TESTS FAILED!');
            console.log('Some fields are still showing encrypted data.');
        }
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }

    return allPassed;
}

// Run the test
testAllEncryptedFields()
    .then((passed) => {
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
