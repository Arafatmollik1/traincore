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

  const singleChallenges = [
    {
      id: "seed-challenge-pushup",
      title: "50 pushups in 5 minutes",
      description:
        "The classic. Fifty clean pushups, chest low, arms locked out — you have five minutes.",
      exercise: "PUSHUP" as const,
      targetReps: 50,
      timeLimitSeconds: 300,
      featuredAt: now,
      badgeSprite: "sprite_0002.png",
    },
    {
      id: "seed-challenge-squat",
      title: "100 squat century",
      description: "One hundred deep squats in ten minutes. Pace yourself.",
      exercise: "SQUAT" as const,
      targetReps: 100,
      timeLimitSeconds: 600,
      featuredAt: null,
      badgeSprite: "sprite_0003.png",
    },
    {
      id: "seed-challenge-jj",
      title: "Jumping jack blitz",
      description: "60 jumping jacks in 2 minutes. Pure cardio sprint.",
      exercise: "JUMPING_JACK" as const,
      targetReps: 60,
      timeLimitSeconds: 120,
      featuredAt: null,
      badgeSprite: "sprite_0004.png",
    },
  ];
  for (const challenge of singleChallenges) {
    await prisma.challenge.upsert({
      where: { id: challenge.id },
      update: { badgeSprite: challenge.badgeSprite },
      create: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        badgeSprite: challenge.badgeSprite,
        featuredAt: challenge.featuredAt,
        createdById: admin.id,
        segments: {
          create: [
            {
              order: 0,
              exercise: challenge.exercise,
              targetReps: challenge.targetReps,
              timeLimitSeconds: challenge.timeLimitSeconds,
            },
          ],
        },
      },
    });
  }

  // Multi-exercise circuit — includes a duplicate exercise (pushups twice).
  await prisma.challenge.upsert({
    where: { id: "seed-challenge-circuit" },
    update: { badgeSprite: "sprite_0001.png" },
    create: {
      id: "seed-challenge-circuit",
      title: "Full-body starter circuit",
      badgeSprite: "sprite_0001.png",
      description:
        "Four rounds, one badge: pushups, squats, a second pushup set, then sit-ups. Rest between rounds is built in.",
      createdById: admin.id,
      segments: {
        create: [
          { order: 0, exercise: "PUSHUP", targetReps: 10, timeLimitSeconds: 120, restAfterSeconds: 30 },
          { order: 1, exercise: "SQUAT", targetReps: 15, timeLimitSeconds: 120, restAfterSeconds: 30 },
          { order: 2, exercise: "PUSHUP", targetReps: 5, timeLimitSeconds: 60, restAfterSeconds: 30 },
          { order: 3, exercise: "SITUP", targetReps: 10, timeLimitSeconds: 120 },
        ],
      },
    },
  });

  // Two captured pose signatures: arms down at the sides, then arms overhead.
  const armRaises = await prisma.customExercise.upsert({
    where: { id: "seed-exercise-arm-raises" },
    update: {},
    create: {
      id: "seed-exercise-arm-raises",
      name: "Arm raises",
      emoji: "🙌",
      poses: [
        {
          leftElbow: 170, rightElbow: 170,
          leftShoulder: 20, rightShoulder: 20,
          leftHip: 172, rightHip: 172,
          leftKnee: 175, rightKnee: 175,
        },
        {
          leftElbow: 165, rightElbow: 165,
          leftShoulder: 160, rightShoulder: 160,
          leftHip: 172, rightHip: 172,
          leftKnee: 175, rightKnee: 175,
        },
      ],
      // 13-point stick frames: nose, shoulders, elbows, wrists, hips, knees, ankles
      keyframes: [
        [
          [0.50, 0.10],
          [0.42, 0.22], [0.58, 0.22],
          [0.40, 0.34], [0.60, 0.34],
          [0.39, 0.46], [0.61, 0.46],
          [0.45, 0.48], [0.55, 0.48],
          [0.45, 0.66], [0.55, 0.66],
          [0.45, 0.84], [0.55, 0.84],
        ],
        [
          [0.50, 0.14],
          [0.42, 0.26], [0.58, 0.26],
          [0.38, 0.14], [0.62, 0.14],
          [0.40, 0.02], [0.60, 0.02],
          [0.45, 0.50], [0.55, 0.50],
          [0.45, 0.68], [0.55, 0.68],
          [0.45, 0.86], [0.55, 0.86],
        ],
      ],
      createdById: coach.id,
    },
  });
  await prisma.challenge.upsert({
    where: { id: "seed-challenge-arm-raises" },
    update: { badgeSprite: "sprite_0000.png" },
    create: {
      id: "seed-challenge-arm-raises",
      title: "30 arm raises, no rest",
      badgeSprite: "sprite_0000.png",
      description:
        "A community-made exercise: raise both arms overhead and back down. Thirty in three minutes.",
      createdById: coach.id,
      segments: {
        create: [
          {
            order: 0,
            customExerciseId: armRaises.id,
            targetReps: 30,
            timeLimitSeconds: 180,
          },
        ],
      },
    },
  });
  await prisma.challenge.upsert({
    where: { id: "seed-challenge-archived" },
    update: {},
    create: {
      id: "seed-challenge-archived",
      title: "Old-school situp marathon",
      description: "Retired challenge kept for the history books.",
      archivedAt: now,
      createdById: athlete.id,
      segments: {
        create: [
          { order: 0, exercise: "SITUP", targetReps: 40, timeLimitSeconds: 600 },
        ],
      },
    },
  });

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
