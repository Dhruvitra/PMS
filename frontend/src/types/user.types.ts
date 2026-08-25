export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  mobileNo: string | null;
  technology: string | null;
  createdAt: string;
  settings?: any;
  isPlatformAdmin?: boolean;
  _count?: {
    spaceMemberships: number;
    folderMemberships: number;
    listMemberships: number;
    assignedTasks: number;
  };
}
