import { prisma } from '../server';

export interface PreferenceUpdateData {
  theme?: string;
  language?: string;
  timezone?: string;
  dateFormat?: string;
  startPage?: string;
  taskReminder?: boolean;
  reminderDays?: number;
  projectNotify?: boolean;
  systemNotify?: boolean;
  emailNotify?: boolean;
  dndStart?: string;
  dndEnd?: string;
  sidebarCollapsed?: boolean;
  pageSize?: number;
  defaultView?: string;
  showStats?: boolean;
}

export async function getPreferences(userId: string) {
  let pref = await prisma.userPreference.findUnique({ where: { userId } });
  if (!pref) {
    pref = await prisma.userPreference.create({ data: { userId } });
  }
  return pref;
}

export async function updatePreferences(userId: string, data: PreferenceUpdateData) {
  return prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
