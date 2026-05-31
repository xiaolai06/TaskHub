import { prisma } from '../server';

export interface ProfileUpdateData {
  bio?: string;
  birthday?: string;
  zodiac?: string;
  mbti?: string;
  phone?: string;
  location?: string;
  company?: string;
  title?: string;
  website?: string;
  tags?: string[];
  avatarType?: string;
  avatarValue?: string;
}

export async function getProfile(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, avatar: true },
  });
  return { user, profile };
}

export async function updateProfile(userId: string, data: ProfileUpdateData) {
  const updateData: Record<string, unknown> = {};
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null;
  if (data.zodiac !== undefined) updateData.zodiac = data.zodiac;
  if (data.mbti !== undefined) updateData.mbti = data.mbti;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.avatarType !== undefined) updateData.avatarType = data.avatarType;
  if (data.avatarValue !== undefined) updateData.avatarValue = data.avatarValue;

  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  });
}
