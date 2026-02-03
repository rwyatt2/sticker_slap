import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateId } from '@/lib/utils';

// Determine which storage provider to use
const useR2 = Boolean(process.env.R2_ENDPOINT);

// Configure S3 client (works with both AWS S3 and Cloudflare R2)
const s3Client = new S3Client(
  useR2
    ? {
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      }
    : {
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }
);

const bucket = useR2 ? process.env.R2_BUCKET! : process.env.AWS_S3_BUCKET!;

export interface UploadOptions {
  folder?: string;
  contentType?: string;
  filename?: string;
  isPublic?: boolean;
}

/**
 * Generate a unique key for a file
 */
function generateKey(folder: string, filename: string): string {
  const timestamp = Date.now();
  const randomId = generateId(8);
  const extension = filename.split('.').pop() ?? '';
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
  return `${folder}/${timestamp}-${randomId}-${safeName}`;
}

/**
 * Upload a file to S3/R2
 */
export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  options: UploadOptions = {}
): Promise<{ key: string; url: string }> {
  const { folder = 'uploads', contentType = 'application/octet-stream', isPublic = true } = options;

  const key = generateKey(folder, originalFilename);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ...(isPublic && { ACL: 'public-read' }),
  });

  await s3Client.send(command);

  const url = getPublicUrl(key);

  return { key, url };
}

/**
 * Delete a file from S3/R2
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Get a presigned URL for direct upload
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
  folder = 'uploads',
  expiresIn = 3600 // 1 hour
): Promise<{ uploadUrl: string; key: string; fileUrl: string }> {
  const key = generateKey(folder, filename);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const fileUrl = getPublicUrl(key);

  return { uploadUrl, key, fileUrl };
}

/**
 * Get a presigned URL for downloading a private file
 */
export async function getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get the public URL for a file
 */
export function getPublicUrl(key: string): string {
  if (useR2) {
    // For R2, you'd typically use a custom domain or R2.dev subdomain
    return `${process.env.R2_ENDPOINT?.replace('.r2.cloudflarestorage.com', '.r2.dev')}/${key}`;
  }

  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}
