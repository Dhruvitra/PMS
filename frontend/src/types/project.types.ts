export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  organizationId: string;
  spaceId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  _count: {
    tasks: number;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  organizationId: string;
  spaceId?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
