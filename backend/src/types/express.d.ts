import { OrgRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      orgMember?: {
        id: string;
        organizationId: string;
        userId: string;
        role: OrgRole;
      };
      // Captured by express.json()'s verify callback in app.ts -- needed for the Razorpay
      // webhook, whose signature is computed over the exact raw request bytes, not the
      // re-serialized parsed JSON (which can differ in whitespace/key order and would fail
      // verification).
      rawBody?: Buffer;
    }
  }
}

export {};
