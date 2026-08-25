const ALLOWED_CREATOR_EMAILS = [
  'admin@gmail.com',
  'nayanpatel@gmail.com',
  'dhruvik@gmail.com'
];

export const canCreate = (email?: string): boolean =>
  !!email && ALLOWED_CREATOR_EMAILS.includes(email.toLowerCase());
