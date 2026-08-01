import { createInitialState } from '../src/engine/state';
import { serialise, deserialise } from '../src/engine/save';
const s = createInitialState(3);
s.estate.severityUntilDay = 300;
s.estate.houseSpreeOn = 280;
s.estate.warnedUntilDay = 290;
const back = deserialise(serialise(s))!;
console.log('round trip:', back.estate.severityUntilDay, back.estate.houseSpreeOn, back.estate.warnedUntilDay);
// A v3 save with no estate at all, and one with a half-estate.
const old = JSON.parse(serialise(s));
delete old.estate; old.v = 3;
const migrated = deserialise(JSON.stringify(old))!;
console.log('v3 no estate:', JSON.stringify(migrated.estate));
const half = JSON.parse(serialise(s));
half.estate = { shamrock: true, works: [], jpSince: null }; half.v = 3;
const m2 = deserialise(JSON.stringify(half))!;
console.log('v3 half estate:', JSON.stringify(m2.estate));
