import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { handleRouteError, jsonError } from "@/lib/api";

const createSchema = z.object({
  name: z.string().trim().min(3).max(40),
  description: z.string().trim().min(1).max(300),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function GET() {
  try {
    const user = await requireUser();
    const communities = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, posts: true } },
        memberships: { where: { userId: user.id }, select: { id: true } },
      },
    });
    return NextResponse.json(
      communities.map(({ memberships, ...community }) => ({
        ...community,
        joined: memberships.length > 0,
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { name, description } = createSchema.parse(await request.json());
    const slug = slugify(name);
    if (!slug) return jsonError(400, "Pick a name with letters or numbers in it");

    const existing = await prisma.community.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) return jsonError(409, "A community with that name already exists");

    const community = await prisma.community.create({
      data: {
        name,
        slug,
        description,
        createdById: user.id,
        memberships: { create: { userId: user.id } },
      },
    });
    return NextResponse.json(community, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
