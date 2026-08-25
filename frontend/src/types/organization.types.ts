export type OrgRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER' | 'LIMITED_MEMBER' | 'GUEST' | 'HR';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings?: {
    logoUrl?: string;
    [key: string]: any;
  };
  role?: OrgRole; // Added to handle joined role from backend
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
}

export interface List {
  id: string;
  name: string;
  color?: string;
  position: number;
  spaceId: string;
  folderId?: string | null;
  _count?: {
    tasks: number;
  };
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  position: number;
  spaceId: string;
  lists: List[];
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  organizationId: string;
  members: any[];
  folders: Folder[];
  lists: List[]; // standalone lists
  _count?: {
    projects: number;
    folders: number;
    lists: number;
  };
}
