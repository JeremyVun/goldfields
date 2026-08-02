import { describe, expect, it } from 'vitest';
import { deserialise, serialise } from '../src/engine/save';
import { createInitialState } from '../src/engine/state';

/**
 * The fields whose unit now lives in the name rather than in a comment:
 * `fineOwedPence`, `rewardPrintedPence`, `hearth.homeStashCentiOz` and
 * `shaft.depthFeet`. Each is written to disk, so each needs a guard that it
 * comes back off disk holding what it held. Saves in the older shape are not
 * carried forward: the current format is the only one the loader knows.
 */
describe('the ledger fields that carry their unit in the name', () => {
  it('round-trips every renamed field through a save', () => {
    const state = createInitialState(7);
    state.day = 210;
    state.fineOwedPence = 588;
    state.rewardPrintedPence = 24_000;
    state.hearth.homeStashCentiOz = 431;
    state.hearth.homeStashPence = 1_200;
    state.shaft = {
      camp: 'snakey-gully',
      depthFeet: 46,
      bottomAtFeet: 64,
      bottomed: false,
      payable: false,
      richDaysLeft: 0,
      timbered: true,
      pumped: false,
    };

    const back = deserialise(serialise(state));
    expect(back).not.toBeNull();
    expect(back?.fineOwedPence).toBe(588);
    expect(back?.rewardPrintedPence).toBe(24_000);
    expect(back?.hearth.homeStashCentiOz).toBe(431);
    expect(back?.hearth.homeStashPence).toBe(1_200);
    expect(back?.shaft?.depthFeet).toBe(46);
    expect(back?.shaft?.bottomAtFeet).toBe(64);
  });

  it('gives a fresh game a clean sheet under every one of them', () => {
    const back = deserialise(serialise(createInitialState(3)));
    expect(back?.fineOwedPence).toBe(0);
    expect(back?.rewardPrintedPence).toBe(0);
    expect(back?.hearth.homeStashCentiOz).toBe(0);
    expect(back?.shaft).toBeNull();
  });
});
