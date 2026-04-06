import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  region: process.env.DO_SPACES_REGION || "fra1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
});

const BUCKET = process.env.DO_SPACES_BUCKET || "etasks";

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; key: string }> {
  const ext = fileName.split(".").pop() || "bin";
  const key = `attachments/${randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: "public-read",
  }));

  const cdnBase = process.env.DO_SPACES_CDN_URL || `https://${BUCKET}.${process.env.DO_SPACES_REGION || "fra1"}.cdn.digitaloceanspaces.com`;
  return { url: `${cdnBase}/${key}`, key };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}
