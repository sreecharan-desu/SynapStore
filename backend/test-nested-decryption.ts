/**
 * Test script to verify nested relation decryption
 * This tests the specific case of UserStoreRole -> Store relation
 */

import prisma from './lib/prisma';

async function testNestedDecryption() {
    console.log('🔍 Testing Nested Relation Decryption\n');

    try {
        // Find a user with store roles
        const userWithStores = await prisma.userStoreRole.findFirst({
            select: {
                role: true,
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        if (!userWithStores) {
            console.log('⚠️  No user with store roles found');
            return;
        }

        console.log('✅ Found user with store:');
        console.log('   Role:', userWithStores.role);
        console.log('   Store ID:', userWithStores.store.id);
        console.log('   Store Name:', userWithStores.store.name);
        console.log('   Store Slug:', userWithStores.store.slug);

        // Check if store name looks encrypted (Base64)
        const isEncrypted = (value: string) => {
            return value && value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value);
        };

        if (isEncrypted(userWithStores.store.name)) {
            console.log('\n❌ ERROR: Store name is still encrypted!');
            console.log('   This means nested relation decryption is not working');
        } else {
            console.log('\n✅ Store name is properly decrypted');
        }

        // Now test the exact query from auth.ts
        console.log('\n🔍 Testing exact query from auth.ts...\n');

        const stores = await prisma.userStoreRole.findMany({
            where: { userId: userWithStores.store.id }, // using any valid ID
            select: {
                role: true,
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        timezone: true,
                        currency: true,
                        settings: true,
                    },
                },
            },
        });

        if (stores.length > 0) {
            console.log('✅ Found stores:');
            stores.forEach((s, idx) => {
                console.log(`\n   Store ${idx + 1}:`);
                console.log('   - Name:', s.store.name);
                console.log('   - Slug:', s.store.slug);
                console.log('   - Role:', s.role);

                if (isEncrypted(s.store.name)) {
                    console.log('   ❌ ERROR: Name is encrypted!');
                } else {
                    console.log('   ✅ Name is decrypted');
                }
            });
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testNestedDecryption()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
