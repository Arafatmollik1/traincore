import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const now = new Date();

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.traincore.local" },
    update: {},
    create: {
      id: "seed-admin",
      email: "admin@demo.traincore.local",
      displayName: "traincore HQ",
      isAdmin: true,
      onboardedAt: now,
    },
  });

  const coach = await prisma.user.upsert({
    where: { email: "trainer@demo.traincore.local" },
    update: {},
    create: {
      id: "seed-trainer",
      email: "trainer@demo.traincore.local",
      displayName: "Coach Demo",
      onboardedAt: now,
    },
  });

  const athlete = await prisma.user.upsert({
    where: { email: "trainee@demo.traincore.local" },
    update: {},
    create: {
      id: "seed-trainee",
      email: "trainee@demo.traincore.local",
      displayName: "Demo Athlete",
      onboardedAt: now,
    },
  });

  const challenges = [
    {
      id: "seed-challenge-pushup",
      title: "50 pushups in 5 minutes",
      description:
        "The classic. Fifty clean pushups, chest low, arms locked out — you have five minutes.",
      exercise: "PUSHUP" as const,
      targetReps: 50,
      timeLimitSeconds: 300,
    },
    {
      id: "seed-challenge-squat",
      title: "100 squat century",
      description: "One hundred deep squats in ten minutes. Pace yourself.",
      exercise: "SQUAT" as const,
      targetReps: 100,
      timeLimitSeconds: 600,
    },
    {
      id: "seed-challenge-jj",
      title: "Jumping jack blitz",
      description: "60 jumping jacks in 2 minutes. Pure cardio sprint.",
      exercise: "JUMPING_JACK" as const,
      targetReps: 60,
      timeLimitSeconds: 120,
    },
  ];
  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { id: challenge.id },
      update: {},
      create: { ...challenge, createdById: admin.id },
    });
  }

  await prisma.competition.upsert({
    where: { id: "seed-comp-live" },
    update: {},
    create: {
      id: "seed-comp-live",
      title: "Weekly pushup showdown",
      description:
        "As many pushups as you can in one 3-minute attempt. Best attempt counts. Ends Sunday night!",
      exercise: "PUSHUP",
      startsAt: new Date(now.getTime() - 1 * DAY),
      endsAt: new Date(now.getTime() + 6 * DAY),
      createdById: admin.id,
    },
  });

  const pastComp = await prisma.competition.upsert({
    where: { id: "seed-comp-past" },
    update: {},
    create: {
      id: "seed-comp-past",
      title: "Squat week (finished)",
      description: "Last week's squat battle — check the final standings.",
      exercise: "SQUAT",
      startsAt: new Date(now.getTime() - 9 * DAY),
      endsAt: new Date(now.getTime() - 2 * DAY),
      createdById: admin.id,
    },
  });

  await prisma.competitionEntry.upsert({
    where: {
      competitionId_userId: { competitionId: pastComp.id, userId: athlete.id },
    },
    update: {},
    create: {
      competitionId: pastComp.id,
      userId: athlete.id,
      bestReps: 42,
      bestAttemptAt: new Date(now.getTime() - 3 * DAY),
    },
  });
  await prisma.competitionEntry.upsert({
    where: {
      competitionId_userId: { competitionId: pastComp.id, userId: coach.id },
    },
    update: {},
    create: {
      competitionId: pastComp.id,
      userId: coach.id,
      bestReps: 55,
      bestAttemptAt: new Date(now.getTime() - 4 * DAY),
    },
  });

  const community = await prisma.community.upsert({
    where: { slug: "getting-started" },
    update: {},
    create: {
      id: "seed-community",
      name: "Getting started",
      slug: "getting-started",
      description: "New to traincore? Say hi and share your first workout.",
      createdById: admin.id,
    },
  });
  for (const userId of [admin.id, coach.id, athlete.id]) {
    await prisma.membership.upsert({
      where: { communityId_userId: { communityId: community.id, userId } },
      update: {},
      create: { communityId: community.id, userId },
    });
  }

  const post = await prisma.post.upsert({
    where: { id: "seed-post" },
    update: {},
    create: {
      id: "seed-post",
      communityId: community.id,
      authorId: athlete.id,
      title: "Just did my first ML-counted pushups!",
      body: "The camera counted 23 pushups — brutal but fun. Anyone got tips for improving pace in the last minute?",
    },
  });
  const comment = await prisma.comment.upsert({
    where: { id: "seed-comment" },
    update: {},
    create: {
      id: "seed-comment",
      postId: post.id,
      authorId: coach.id,
      body: "Nice work! Try breaking it into sets of 8 with 5-second shakeouts.",
    },
  });
  await prisma.comment.upsert({
    where: { id: "seed-reply" },
    update: {},
    create: {
      id: "seed-reply",
      postId: post.id,
      authorId: athlete.id,
      parentId: comment.id,
      body: "Will do — thanks coach!",
    },
  });

  console.log("Seeded: 3 users, 3 challenges, 2 competitions, 1 community");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
