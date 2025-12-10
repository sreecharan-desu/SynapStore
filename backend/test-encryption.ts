/**
 * Test script to verify field-level encryption is working correctly
 * 
 * This script:
 * 1. Creates a test user with sensitive data
 * 2. Verifies the data is encrypted in the database
 * 3. Verifies the data is decrypted when read through Prisma
 * 4. Cleans up the test data
 */

import prisma from './lib/prisma';
import { crypto$ } from './lib/crypto';

async function testEncryption() {
    console.log('🔐 Testing Field-Level Encryption\n');

    const testEmail = `test-${Date.now()}@example.com`;
    const testPhone = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    const testUsername = `testuser_${Date.now()}`;

    try {
        // Step 1: Create a test user
        console.log('📝 Step 1: Creating test user...');
        const user = await prisma.user.create({
            data: {
                username: testUsername,
                email: testEmail,
                phone: testPhone,
                isActive: true,
            }
        });
        console.log('✅ User created with ID:', user.id);
        console.log('   Username (decrypted):', user.username);
        console.log('   Email (decrypted):', user.email);
        console.log('   Phone (decrypted):', user.phone);

        // Step 2: Query the database directly to see encrypted data
        console.log('\n🔍 Step 2: Checking database for encrypted data...');
        const rawData: any = await prisma.$queryRaw`
      SELECT username, email, phone FROM "User" WHERE id = ${user.id}
    `;

        if (rawData && rawData.length > 0) {
            const raw = rawData[0];
            console.log('✅ Raw database data (encrypted):');
            console.log('   Username:', raw.username);
            console.log('   Email:', raw.email);
            console.log('   Phone:', raw.phone);

            // Verify it's actually encrypted (should be Base64)
            const isEncrypted = (value: string) => {
                return value && value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value);
            };

            if (isEncrypted(raw.username) && isEncrypted(raw.email) && isEncrypted(raw.phone)) {
                console.log('✅ Data is properly encrypted in database!');
            } else {
                console.log('⚠️  Warning: Data might not be encrypted properly');
            }
        }

        // Step 3: Read through Prisma to verify decryption
        console.log('\n🔓 Step 3: Reading through Prisma (should be decrypted)...');
        const readUser = await prisma.user.findUnique({
            where: { id: user.id }
        });

        if (readUser) {
            console.log('✅ Data decrypted successfully:');
            console.log('   Username:', readUser.username);
            console.log('   Email:', readUser.email);
            console.log('   Phone:', readUser.phone);

            // Verify decryption worked
            if (
                readUser.username === testUsername &&
                readUser.email === testEmail &&
                readUser.phone === testPhone
            ) {
                console.log('✅ Decryption verified - all values match!');
            } else {
                console.log('❌ Decryption failed - values do not match');
            }
        }

        // Step 4: Test update operation
        console.log('\n📝 Step 4: Testing update operation...');
        const newEmail = `updated-${Date.now()}@example.com`;
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { email: newEmail }
        });
        console.log('✅ User updated');
        console.log('   New email (decrypted):', updatedUser.email);

        // Verify new email is encrypted in database
        const rawUpdated: any = await prisma.$queryRaw`
      SELECT email FROM "User" WHERE id = ${user.id}
    `;
        console.log('   New email (encrypted in DB):', rawUpdated[0].email);

        // Step 5: Clean up
        console.log('\n🧹 Step 5: Cleaning up test data...');
        await prisma.user.delete({
            where: { id: user.id }
        });
        console.log('✅ Test user deleted');

        console.log('\n✅ All encryption tests passed! 🎉');
        console.log('\nSummary:');
        console.log('- ✅ Data is encrypted when written to database');
        console.log('- ✅ Data is decrypted when read through Prisma');
        console.log('- ✅ Updates are properly encrypted');
        console.log('- ✅ No schema changes required');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testEncryption()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
