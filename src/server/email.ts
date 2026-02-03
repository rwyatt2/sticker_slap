import { env } from '@/lib/env';

/**
 * Email service interface
 */
interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Base URL for email links
 */
function getBaseUrl(): string {
  // In production, use the configured base URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  // In development, use localhost
  return 'http://localhost:3000';
}

/**
 * Send an email
 *
 * In development, this logs the email to the console.
 * In production, you should integrate with an email service like:
 * - Resend
 * - SendGrid
 * - AWS SES
 * - Postmark
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, text, html } = options;

  // In development, log the email
  if (process.env.NODE_ENV === 'development') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL (Development Mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(text);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return true;
  }

  // Production: Integrate with your email service
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'Sticker Slap <noreply@yourdomain.com>',
  //   to,
  //   subject,
  //   text,
  //   html,
  // });

  // For now, throw an error in production if email service is not configured
  if (!process.env.EMAIL_SERVICE_CONFIGURED) {
    console.error('Email service not configured in production');
    return false;
  }

  return true;
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  return sendEmail({
    to: email,
    subject: 'Verify your email address - Sticker Slap',
    text: `
Welcome to Sticker Slap!

Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

Thanks,
The Sticker Slap Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">Sticker Slap</h1>
  </div>
  
  <h2>Welcome to Sticker Slap!</h2>
  
  <p>Please verify your email address by clicking the button below:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 28px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
      Verify Email Address
    </a>
  </div>
  
  <p style="color: #666; font-size: 14px;">
    Or copy and paste this link into your browser:<br>
    <a href="${verificationUrl}" style="color: #6366f1; word-break: break-all;">${verificationUrl}</a>
  </p>
  
  <p style="color: #666; font-size: 14px;">
    This link will expire in 24 hours.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px;">
    If you didn't create an account, you can safely ignore this email.
  </p>
</body>
</html>
    `.trim(),
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: 'Reset your password - Sticker Slap',
    text: `
You requested to reset your password for Sticker Slap.

Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Thanks,
The Sticker Slap Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">Sticker Slap</h1>
  </div>
  
  <h2>Reset Your Password</h2>
  
  <p>You requested to reset your password. Click the button below to create a new password:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
      Reset Password
    </a>
  </div>
  
  <p style="color: #666; font-size: 14px;">
    Or copy and paste this link into your browser:<br>
    <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
  </p>
  
  <p style="color: #666; font-size: 14px;">
    This link will expire in 1 hour.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px;">
    If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
  </p>
</body>
</html>
    `.trim(),
  });
}

/**
 * Send welcome email after successful registration
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const dashboardUrl = `${baseUrl}/dashboard`;

  return sendEmail({
    to: email,
    subject: 'Welcome to Sticker Slap! 🎉',
    text: `
Hi ${name},

Welcome to Sticker Slap! Your account has been successfully verified.

You can now start creating amazing sticker compositions:
${dashboardUrl}

Need help getting started? Check out our documentation or reach out to support.

Thanks,
The Sticker Slap Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Sticker Slap</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">Sticker Slap</h1>
  </div>
  
  <h2>Welcome, ${name}! 🎉</h2>
  
  <p>Your account has been successfully verified and you're all set to start creating amazing sticker compositions.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
      Go to Dashboard
    </a>
  </div>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  
  <p style="color: #999; font-size: 12px;">
    Need help? Reply to this email or check out our documentation.
  </p>
</body>
</html>
    `.trim(),
  });
}
