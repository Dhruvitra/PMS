import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { JwtPayload } from '../types/common';
import { InvitationService } from './invitation.service';
import { OrganizationService } from './organization.service';
import { EmailService } from './email.service';
import { PlanService } from './plan.service';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteToken?: string;
  role?: string;
}

interface RegisterCompanyInput {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  planId: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }


    let invitationDetails = null;

    // Check if this is the very first user in the system
    const userCount = await prisma.user.count();

    if (userCount > 0) {
      if (!input.inviteToken) {
        throw ApiError.forbidden('Registration is currently by invitation only.');
      }

      // Validate invite token and ensure it matches the email
      invitationDetails = await InvitationService.validateInvite(input.inviteToken);
      if (invitationDetails.email.toLowerCase() !== input.email.toLowerCase()) {
        throw ApiError.forbidden('This invite token is for a different email address.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    // If this is the first user, create a default organization for them and assign them SUPER_ADMIN
    if (userCount === 0) {
      await OrganizationService.create({
        name: 'My Workspace',
        slug: 'my-workspace',
        ownerId: user.id,
        role: 'SUPER_ADMIN'
      });
    }

    // If there is an invitation to accept, automatically accept it
    if (invitationDetails && input.inviteToken) {
      await InvitationService.acceptInvite(input.inviteToken, user.id);
    }

    const tokens = AuthService.generateTokens({ userId: user.id, email: user.email });
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /** Public company signup -- a brand-new paying customer, distinct from the invite-based
   *  member-registration path above. Creates the org PENDING_PAYMENT (currently doubling as
   *  "pending manual approval" while online checkout is disabled -- see login()'s status gate,
   *  which is what actually blocks these accounts until a platform admin approves them) and does
   *  NOT return auth tokens, so the new owner has no session immediately after signing up. */
  static async registerCompany(input: RegisterCompanyInput): Promise<{ organization: { id: string; name: string; slug: string; status: string } }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    const plan = await PlanService.getById(input.planId);
    if (!plan) {
      throw ApiError.badRequest('Invalid plan selected');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    const slug = input.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `company-${Date.now()}`;

    const org = await OrganizationService.create({
      name: input.companyName,
      slug,
      ownerId: user.id,
      role: 'OWNER',
      status: 'PENDING_PAYMENT',
      planId: plan.id,
    });

    return {
      organization: { id: org.id, name: org.name, slug: org.slug, status: 'PENDING_PAYMENT' },
    };
  }

  static async login(email: string, password: string, inviteToken?: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Platform admins need to be able to log in unconditionally (they're the ones who approve
    // everyone else). For everyone else, block login only if EVERY org they belong to is
    // non-ACTIVE -- a user invited into another already-active org shouldn't be locked out just
    // because their own company signup is still pending approval.
    if (!user.isPlatformAdmin) {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: { select: { status: true } } },
      });
      const hasActiveOrg = memberships.some(m => m.organization.status === 'ACTIVE');
      if (memberships.length > 0 && !hasActiveOrg) {
        const blockingStatus = memberships[0].organization.status;
        if (blockingStatus === 'SUSPENDED') {
          throw ApiError.forbidden('Your workspace has been suspended. Please contact support.');
        }
        if (blockingStatus === 'REJECTED') {
          throw ApiError.forbidden('Your signup request was not approved. Please contact support.');
        }
        throw ApiError.forbidden('Your account is pending approval. We will email you as soon as it is approved.');
      }
    }

    // If an invite token is provided, accept it for this user
    if (inviteToken) {
      const invitation = await InvitationService.validateInvite(inviteToken);
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        throw ApiError.forbidden('This invite token is for a different email address.');
      }
      await InvitationService.acceptInvite(inviteToken, user.id);
    }

    const tokens = AuthService.generateTokens({ userId: user.id, email: user.email });
    await AuthService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  static async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    let exists = true;
    try {
      exists = (await redis.exists(`refresh:${payload.userId}:${refreshToken}`)) === 1;
    } catch (err) {
      console.warn('Redis unavailable during refresh, trusting JWT signature only');
      exists = true; // Trust token if Redis is down
    }

    if (!exists) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Rotate: this exact refresh token is single-use, but only removes this one session's
    // entry -- other concurrent sessions (other tabs, the desktop tracker, etc.) are untouched.
    try {
      await redis.del(`refresh:${payload.userId}:${refreshToken}`);
    } catch {
      // ignore Redis error
    }

    const tokens = AuthService.generateTokens({ userId: payload.userId, email: payload.email });
    await AuthService.storeRefreshToken(payload.userId, tokens.refreshToken);

    return tokens;
  }

  /** refreshToken omitted -- can't identify which single session to revoke, so it's a no-op
   *  (the access token still expires normally on its own). Pass it whenever it's available. */
  static async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    try {
      await redis.del(`refresh:${userId}:${refreshToken}`);
    } catch {
      // ignore Redis error
    }
  }

  static async checkEmail(email: string): Promise<{ exists: boolean }> {
    const user = await prisma.user.findUnique({ where: { email } });
    return { exists: !!user };
  }

  static async testEmail(to: string) {
    return EmailService.sendInvitation({
      to,
      orgName: 'Diagnostics Workspace',
      inviterName: 'System Diagnostic',
      token: 'test-token',
      role: 'ADMIN'
    });
  }

  static async forgotPassword(email: string): Promise<{ message: string }> {
    const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: genericMessage };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store hashed token in Redis with 1 hour expiry
    try {
      await redis.set(`reset:${hashedToken}`, user.id, 'EX', 3600);
    } catch {
      // If Redis is not available, store token anyway
    }

    // The token must only ever reach the user via their email inbox — never
    // returned in the API response, or anyone who knows the email address
    // could reset the account's password themselves.
    await EmailService.sendPasswordReset(user.email, resetToken);

    return { message: genericMessage };
  }

  static async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    let userId: string | null = null;
    try {
      userId = await redis.get(`reset:${hashedToken}`);
    } catch {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    if (!userId) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete the used token
    try {
      await redis.del(`reset:${hashedToken}`);
    } catch {
      // ignore
    }

    return { message: 'Password has been reset successfully' };
  }

  private static generateTokens(payload: JwtPayload): AuthTokens {
    return {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }

  // Keyed per-token (not just per-user) so a user can hold multiple valid sessions at once --
  // e.g. the web app in a browser tab and the desktop Tracker app logged in simultaneously, or
  // several browser tabs. A single shared `refresh:${userId}` key meant every new login/refresh
  // silently invalidated every *other* session's refresh token, since it overwrote the one
  // stored value -- surfacing as random "Failed to update profile" / "Server error" screens in
  // whichever session refreshed less recently, once its access token expired.
  private static async storeRefreshToken(userId: string, token: string): Promise<void> {
    try {
      await redis.set(`refresh:${userId}:${token}`, '1', 'EX', 7 * 24 * 60 * 60); // 7 days
    } catch (err) {
      console.error('Failed to store refresh token in Redis:', err);
    }
  }
}
