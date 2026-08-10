// The available badge artwork (files in public/badges). Challenge creators
// pick one; completers earn it on their profile.
export const BADGE_SPRITES = [
  "sprite_0000.png",
  "sprite_0001.png",
  "sprite_0002.png",
  "sprite_0003.png",
  "sprite_0004.png",
  "sprite_0005.png",
  "sprite_0006.png",
  "sprite_0007.png",
  "sprite_0008.png",
  "sprite_0009.png",
  "sprite_0010.png",
  "sprite_0011.png",
  "sprite_0012.png",
  "sprite_0013.png",
  "sprite_0014.png",
  "sprite_0015.png",
  "sprite_0016.png",
  "sprite_0017.png",
  "sprite_0018.png",
  "sprite_0019.png",
  "sprite_0020.png",
  "sprite_0021.png",
  "sprite_0022.png",
  "sprite_0023.png",
  "sprite_0024.png",
  "sprite_0025.png",
  "sprite_0026.png",
  "sprite_0027.png",
  "sprite_0028.png",
  "sprite_0029.png",
  "sprite_0030.png",
  "sprite_0031.png",
  "sprite_0032.png",
  "sprite_0034.png",
  "sprite_0035.png",
  "sprite_0036.png",
  "sprite_0038.png",
] as const;

export function badgeSpriteUrl(sprite: string): string {
  return `/badges/${sprite}`;
}

export function isValidBadgeSprite(sprite: string): boolean {
  return (BADGE_SPRITES as readonly string[]).includes(sprite);
}
