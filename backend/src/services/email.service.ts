import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Initialize Resend conditionally
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static {
    console.log(`[EmailService] Initialized for ${process.env.SMTP_USER}`);
  }

  /**
   * Sends a workspace invitation email.
   */
  static async sendInvitation(data: {
    to: string;
    orgName: string;
    inviterName: string;
    token: string;
    role: string;
  }) {
    const { to, orgName, inviterName, token, role } = data;
    const frontendUrl = process.env.FRONTEND_URL || 'http://producteevpro.com';
    const inviteLink = `${frontendUrl}/register?token=${token}`;

    const html = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e2530; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #7B3FF2 0%, #5b21d5 100%); padding: 35px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Producteev</h1>
          <p style="color: #e0d4fc; margin: 10px 0 0; font-size: 15px;">By Shreeji Software</p>
        </div>
        <div style="padding: 40px 35px;">
          <h2 style="margin-top: 0; font-size: 22px; color: #1e2530; font-weight: 700;">You've been invited! 🎉</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 25px;">Hi there,</p>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 35px;">
            <strong style="color: #1e2530;">${inviterName}</strong> has invited you to collaborate in the <strong style="color: #1e2530;">${orgName}</strong> workspace as a <strong style="color: #7B3FF2; background: #f3f0ff; padding: 2px 8px; border-radius: 4px;">${role}</strong>.
          </p>
          
          <div style="margin: 40px 0; text-align: center;">
            <a href="${inviteLink}" style="background-color: #7B3FF2; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(123, 63, 242, 0.3);">
              Accept Invitation
            </a>
            <div style="margin-top: 25px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #7B3FF2; word-break: break-all; margin: 0; font-family: monospace;">${inviteLink}</p>
            </div>
          </div>
          
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-top: 35px;">
            Ready to get started? Join us and let's build something amazing together!
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 35px 0 25px;" />
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
              Securely sent via Producteev PMS Platform
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0;">
              © ${new Date().getFullYear()} Shreeji Software. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    console.log(`[EmailService] Attempting to send invite to: ${to}`);

    try {
      // Prioritize Gmail (SMTP) if credentials are NOT placeholder/missing
      const isConfigured = !!process.env.SMTP_USER && !!process.env.SMTP_PASS &&
        process.env.SMTP_USER !== 'YOUR_EMAIL@gmail.com';

      if (isConfigured) {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || `"Shreeji Software" <${process.env.SMTP_USER}>`,
          to,
          subject: `${inviterName} invited you to join ${orgName} on Producteev`,
          html,
        });
        console.log(`Email sent successfully via Gmail (SMTP) to ${to}`);
        return;
      }

      // Fallback: Try Resend if API Key is present
      if (resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Producteev <onboarding@resend.dev>',
          to,
          subject: `${inviterName} invited you to join ${orgName} on Producteev`,
          html,
        });
        console.log(`Email sent via Resend to ${to}`);
        return;
      }

      console.warn('--- EMAIL MOCK (No credentials) ---');
      console.warn(`To: ${to}`);
      console.warn(`Invite Link: ${inviteLink}`);
      console.warn('----------------------------------');

    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Sends a password reset email.
   */
  static async sendPasswordReset(to: string, token: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Must match the route actually registered in App.tsx (/forgot-password),
    // which reads ?token= from the URL to jump straight to the "set new password" step.
    const resetLink = `${frontendUrl}/forgot-password?token=${token}`;

    const html = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e2530; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #7B3FF2 0%, #5b21d5 100%); padding: 35px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Producteev</h1>
          <p style="color: #e0d4fc; margin: 10px 0 0; font-size: 15px;">Secure Access Control</p>
        </div>
        <div style="padding: 40px 35px;">
          <h2 style="margin-top: 0; font-size: 22px; color: #1e2530; font-weight: 700;">Reset Your Password</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 25px;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 35px;">
            We received a request to reset the password for your Producteev account. Click the button below to choose a new one.
          </p>
          
          <div style="margin: 40px 0; text-align: center;">
            <a href="${resetLink}" style="background-color: #7B3FF2; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(123, 63, 242, 0.3);">
              Reset Password
            </a>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-top: 35px; border-left: 3px solid #e2e8f0; padding-left: 15px;">
            If you did not request a password reset, you can safely ignore this email. This link will expire in 1 hour.
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 35px 0 25px;" />
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
              Securely sent via Producteev PMS Platform
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0;">
              © ${new Date().getFullYear()} Shreeji Software. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      if (process.env.SMTP_USER) {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || `"Producteev Security" <${process.env.SMTP_USER}>`,
          to,
          subject: `Reset your Producteev password`,
          html,
        });
        console.log(`Password reset email sent to ${to}`);
      }
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  }

  /**
   * Sends the "your workspace has been approved" email once a platform admin manually
   * activates a company that signed up through the public signup flow.
   */
  static async sendAccountApproved(to: string, data: { firstName: string; orgName: string }) {
    const { firstName, orgName } = data;
    const frontendUrl = process.env.FRONTEND_URL || 'http://producteevpro.com';
    const loginLink = `${frontendUrl}/login`;

    const html = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e2530; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #7B3FF2 0%, #5b21d5 100%); padding: 35px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Producteev</h1>
          <p style="color: #e0d4fc; margin: 10px 0 0; font-size: 15px;">By Shreeji Software</p>
        </div>
        <div style="padding: 40px 35px;">
          <h2 style="margin-top: 0; font-size: 22px; color: #1e2530; font-weight: 700;">You're all set, ${firstName}! 🎉</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 35px;">
            Your workspace <strong style="color: #1e2530;">${orgName}</strong> has been approved and is now active. You can log in with the email and password you created during signup.
          </p>

          <div style="margin: 40px 0; text-align: center;">
            <a href="${loginLink}" style="background-color: #7B3FF2; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(123, 63, 242, 0.3);">
              Log in now
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 35px 0 25px;" />
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
              Securely sent via Producteev PMS Platform
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0;">
              © ${new Date().getFullYear()} Shreeji Software. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      const isConfigured = !!process.env.SMTP_USER && !!process.env.SMTP_PASS &&
        process.env.SMTP_USER !== 'YOUR_EMAIL@gmail.com';

      if (isConfigured) {
        await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || `"Shreeji Software" <${process.env.SMTP_USER}>`,
          to,
          subject: `Your ${orgName} workspace is approved!`,
          html,
        });
        console.log(`Account approved email sent to ${to}`);
        return;
      }

      if (resend) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Producteev <onboarding@resend.dev>',
          to,
          subject: `Your ${orgName} workspace is approved!`,
          html,
        });
        console.log(`Account approved email sent via Resend to ${to}`);
        return;
      }

      console.warn('--- EMAIL MOCK (No credentials) ---');
      console.warn(`To: ${to}`);
      console.warn(`Login link: ${loginLink}`);
      console.warn('----------------------------------');
    } catch (error) {
      console.error('Error sending account approved email:', error);
    }
  }
}
