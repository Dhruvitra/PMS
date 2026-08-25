import { OrgRole } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { EmailService } from './email.service';
import { OrganizationService } from './organization.service';

interface CreateInviteInput {
  organizationId: string;
  invitedById: string;
  email: string;
  role?: OrgRole;
}

export class InvitationService {
  /**
   * Creates a new invitation for an email address.
   * Only OWNER or ADMIN can invite.
   */
  static async createInvite(input: CreateInviteInput) {
    const { organizationId, invitedById, email, role = OrgRole.MEMBER } = input;

    // Check org exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw ApiError.notFound('Organization not found');

    // Check inviter is OWNER, SUPER_ADMIN or ADMIN
    const inviterMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: invitedById } },
    });
    if (!inviterMembership || !['OWNER', 'SUPER_ADMIN', 'ADMIN'].includes(inviterMembership.role)) {
      throw ApiError.forbidden('Only OWNER, SUPER_ADMIN or ADMIN can send invitations');
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } },
      });
      if (existingMember) throw ApiError.conflict('User is already a member of this organization');
    }

    // Deactivate any previous pending invite for the same email in the same org
    await prisma.invitation.updateMany({
      where: { organizationId, email, usedAt: null },
      data: { usedAt: new Date() }, // mark as used/cancelled
    });

    // Create new invite with 7-day expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        invitedById,
        email,
        role,
        token,
        expiresAt,
      },
      include: { 
        organization: { select: { name: true, slug: true } },
        invitedBy: { select: { firstName: true, lastName: true } }
      },
    });

    // Send the invitation email and capture the result so the caller knows
    // whether SMTP delivery succeeded (corporate / non-Gmail recipients
    // sometimes get bounced or filtered, so we surface the error to the API).
    let emailStatus: { sent: boolean; error?: string } = { sent: false };
    try {
      await EmailService.sendInvitation({
        to: invitation.email,
        orgName: invitation.organization.name,
        inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`,
        token: invitation.token,
        role: invitation.role,
      });
      emailStatus = { sent: true };
    } catch (err: any) {
      console.error('Failed to send invitation email:', err);
      emailStatus = { sent: false, error: err?.message || 'Email delivery failed' };
    }

    return { ...invitation, emailStatus };
  }

  /**
   * Validates an invite token and returns invite details.
   * Returns null if token is invalid, expired, or already used.
   */
  static async validateInvite(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!invitation) throw ApiError.notFound('Invalid invitation link');
    if (invitation.usedAt) throw ApiError.badRequest('This invitation has already been used');
    if (invitation.expiresAt < new Date()) throw ApiError.badRequest('This invitation has expired');

    return invitation;
  }
  
  /**
   * Validates an invite ID and returns invite details.
   */
  static async validateInviteById(id: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) throw ApiError.notFound('Invitation not found');
    return invitation;
  }

  /**
   * Accepts an invite: marks it used and adds user to org with the correct role.
   */
  static async acceptInvite(token: string, userId: string) {
    const invitation = await InvitationService.validateInvite(token);

    // Add user to org
    await OrganizationService.addMember(invitation.organizationId, userId, invitation.role);

    // Mark invite as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });

    return { organizationId: invitation.organizationId, role: invitation.role };
  }

  /**
   * Lists all pending invitations for an organization.
   */
  static async listInvites(organizationId: string) {
    return prisma.invitation.findMany({
      where: { organizationId, usedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revokes (deletes) a pending invitation.
   */
  static async revokeInvite(id: string) {
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) throw ApiError.notFound('Invitation not found');
    if (invitation.usedAt) throw ApiError.badRequest('Cannot revoke an invitation that has already been used');

    await prisma.invitation.delete({ where: { id } });
  }
}
