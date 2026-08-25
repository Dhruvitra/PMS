export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number;
  description: string | null;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    projectId: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}
