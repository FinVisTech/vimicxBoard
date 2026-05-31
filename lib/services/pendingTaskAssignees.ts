import { prisma } from "@/lib/prisma";

type AssigneeUser = { id: string; name: string };

export function splitPendingAssigneeNames(value: string | null | undefined) {
  const seen = new Set<string>();
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function formatPendingAssigneeNames(users: AssigneeUser[]) {
  return users.length > 0 ? users.map((user) => user.name).join(", ") : null;
}

export async function resolveExistingUsersByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true }
  });

  if (users.length !== uniqueIds.length) return null;

  const byId = new Map(users.map((user) => [user.id, user]));
  return uniqueIds.map((id) => byId.get(id)!);
}

export async function resolveExistingUsersByNames(value: string | null | undefined) {
  const names = splitPendingAssigneeNames(value);
  if (names.length === 0) return { users: [], unknownNames: [] };

  const users = await prisma.user.findMany({
    where: {
      OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } }))
    },
    select: { id: true, name: true }
  });

  const byName = new Map(users.map((user) => [user.name.toLowerCase(), user]));
  return {
    users: names.map((name) => byName.get(name.toLowerCase())).filter((user): user is AssigneeUser => Boolean(user)),
    unknownNames: names.filter((name) => !byName.has(name.toLowerCase()))
  };
}
