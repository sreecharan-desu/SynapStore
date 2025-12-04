import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  KMSClient,
  GenerateDataKeyCommand,
  GenerateDataKeyCommandOutput,
} from "@aws-sdk/client-kms";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("Please set DATABASE_URL environment variable before running this script.");
  process.exit(1);
}

// Create adapter same way your app does
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const awsRegion = process.env.AWS_REGION || "us-east-1";
const kms = new KMSClient({ region: awsRegion });
const secrets = new SecretsManagerClient({ region: awsRegion });
const sts = new STSClient({ region: awsRegion });

const KMS_KEY_ID = process.env.KMS_KEY_ID || "alias/your-kms";
const DEK_SECRET_NAME = process.env.DEK_SECRET_NAME || "dek_wrapped_User";
const HMAC_SECRET_NAME = process.env.HMAC_SECRET_NAME || "hmac_key_user";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "200", 10);

// target columns to encrypt
const TARGET_COLS = ["username", "OtpCode", "imageUrl", "email"];

function aesGcmEncryptBase64(plaintext: string, dekPlain: Buffer): string {
  const nonce = crypto.randomBytes(12); // 96-bit nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", dekPlain, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]).toString("base64");
}

function hmacSha256Hex(keyBuf: Buffer, dataStr: string): string {
  return crypto.createHmac("sha256", keyBuf).update(String(dataStr)).digest("hex");
}

async function ensureAwsCredentials(): Promise<void> {
  try {
    await sts.send(new GetCallerIdentityCommand({}));
    // success -> credentials available
  } catch (err: any) {
    throw new Error(
      "AWS credentials not found or invalid. Configure them with `aws configure`, set AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY (and optional AWS_SESSION_TOKEN), or run via an IAM role. See https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html"
    );
  }
}

async function generateTableDek(): Promise<{ dek_plain: Buffer; dek_wrapped: Buffer }> {
  const cmd = new GenerateDataKeyCommand({
    KeyId: KMS_KEY_ID,
    KeySpec: "AES_256",
  });
  const res: GenerateDataKeyCommandOutput = await kms.send(cmd);
  if (!res.Plaintext || !res.CiphertextBlob) {
    throw new Error("GenerateDataKey failed to return both Plaintext and CiphertextBlob");
  }
  return {
    dek_plain: Buffer.from(res.Plaintext),
    dek_wrapped: Buffer.from(res.CiphertextBlob),
  };
}

async function saveSecret(name: string, payloadObj: Record<string, string>): Promise<void> {
  const payload = JSON.stringify(payloadObj);
  try {
    const create = new CreateSecretCommand({ Name: name, SecretString: payload });
    await secrets.send(create);
    console.log(`Created secret ${name}`);
  } catch (err: any) {
    // if already exists, update
    if (err.name === "ResourceExistsException" || err.code === "ResourceExistsException") {
      const put = new PutSecretValueCommand({ SecretId: name, SecretString: payload });
      await secrets.send(put);
      console.log(`Updated secret ${name}`);
    } else {
      throw err;
    }
  }
}

async function generateAndStoreHmacKey(): Promise<Buffer> {
  const key = crypto.randomBytes(32); // 256-bit HMAC key
  await saveSecret(HMAC_SECRET_NAME, { hmac_key_b64: key.toString("base64") });
  console.log("Saved HMAC key to Secrets Manager:", HMAC_SECRET_NAME);
  return key;
}

async function saveWrappedDek(dek_wrapped: Buffer): Promise<void> {
  await saveSecret(DEK_SECRET_NAME, { dek_wrapped_b64: dek_wrapped.toString("base64") });
  console.log("Saved wrapped DEK to Secrets Manager:", DEK_SECRET_NAME);
}

async function migrate(): Promise<void> {
  console.log("Starting User encryption + email_hmac migration. BACKUP first.");

  // Ensure AWS credentials available (fail fast with friendly message)
  await ensureAwsCredentials();

  // 1) Generate DEK and save wrapped
  const { dek_plain, dek_wrapped } = await generateTableDek();
  await saveWrappedDek(dek_wrapped);

  // 2) generate and store HMAC key
  const hmacKey = await generateAndStoreHmacKey();

  try {
    let offset = 0;
    let processed = 0;
    while (true) {
      const users = await prisma.user.findMany({
        take: BATCH_SIZE,
        skip: offset,
        select: { id: true, username: true, OtpCode: true, imageUrl: true, email: true },
      });
      if (users.length === 0) break;

      for (const u of users) {
        const updates: Record<string, any> = {};
        for (const c of TARGET_COLS) {
          const v = (u as any)[c];
          if (v === null || v === undefined) {
            updates[c] = null;
          } else {
            updates[c] = aesGcmEncryptBase64(String(v), dek_plain);
          }
        }
        updates["email_hmac"] = u.email ? hmacSha256Hex(hmacKey, u.email) : null;

        await prisma.user.update({
          where: { id: u.id },
          data: updates,
        });

        processed++;
        if (processed % 100 === 0) console.log(`Processed ${processed} rows`);
      }

      offset += users.length;
    }

    console.log("Migration finished. Processed:", processed);
  } finally {
    // zero dek_plain
    if (dek_plain) dek_plain.fill(0);
    await prisma.$disconnect();
    console.log("Dek plain zeroed and Prisma disconnected.");
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});