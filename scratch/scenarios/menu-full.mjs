/**
 * The MENU overlay at its very longest: every figure filled, a shaft, a
 * company, salvage, an illness, an engagement, two pegged claims, and the
 * whole dark ladder — hideout, gang and a price on your head. If the menu
 * fits without a scroll here, it fits anywhere.
 *
 *   node scratch/shot.mjs scratch/scenarios/menu-full.mjs --vp all
 */
export const seed = 21;
export const viewports = ['phone-se', 'phone-tall', 'tablet', 'tablet-land', 'desktop'];
export const stops = [{ name: 'menu', keys: ['Escape'] }];

export async function setup(d) {
  d.begin();
  const s = d.state;
  s.day = 210;
  s.location = 'damp-camp';
  s.screen = 'camp';

  // The purse and the keep.
  s.moneyPence = 482_600;
  s.bankPence = 1_240_000;
  s.goldCentiOz = 4_675;
  s.provisionDays = 26;
  s.items.waterBags = 2;
  s.waterDays = 9;

  // The name, both kinds.
  s.standing = 64;
  s.briggsDays = 25;
  s.notoriety = 47;
  s.outlawed = true;
  s.legal = 'wanted criminal';

  // The hands.
  s.skill.wash = 95;
  s.skill.shaft = 41;
  s.skill.bush = 33;

  // What he carries: a full outfit, a horse and salvage.
  for (const k of Object.keys(s.items)) s.items[k] = 2;
  s.horse = 'hack';
  s.salvage = 3;

  s.claims['damp-camp'] = { quality: 130, workedDays: 12, peggedOn: 180, proven: true, registered: true };
  s.claims['dry-camp'] = { quality: 90, workedDays: 3, peggedOn: 200, proven: false };
  s.shaft = {
    camp: 'damp-camp',
    depth: 62,
    bottomAt: 70,
    bottomed: true,
    payable: true,
    richDaysLeft: 8,
    timbered: true,
    pumped: true,
  };
  s.hideout = { stashPence: 96_000, stashGold: 1_200, discovered: false, madeOn: 190 };
  s.gang = [
    { name: 'Black Douglas', joined: 195, loyalty: 0.7 },
    { name: 'Harry the Bricklayer', joined: 202, loyalty: 0.4 },
  ];
}
