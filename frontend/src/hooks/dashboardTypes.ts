export interface DashboardStats {
  projectCount: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  totalCost: number;
  monthlyIncome: number;
  estimatedProfit: number;
  overdueCount: number;
}

export interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  project: { id: string; name: string };
  assignee: { id: string; name: string } | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  quote: number;
  totalTasks: number;
  doneTasks: number;
}

export interface CustomerSummary {
  id: string;
  name: string;
  contact: string;
  status: string;
  projects: number;
  quoteTotal: number;
  completedOrders: number;
  lastContactAt: string | null;
}
