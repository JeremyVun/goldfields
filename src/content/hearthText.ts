/**
 * Every line the hearth speaks (§32), in the Journal's register. Owned by the
 * the presentation layer; the engine refers to these keys through say()/log.say
 * and a missing key shows as a visible placeholder rather than crashing.
 *
 * Taste law (§32, binding): she is a person, not a purchase. Her reasons are
 * always given in her own terms; nothing leers; nothing ranks her.
 */
export const HEARTH_TEXT: Record<string, string[]> = {
  'hearth.meet.ball': [
    'You are introduced to {name}, a {trade} with her own work and her own opinions of the fields. She asks what brought you out; she does not ask what you are worth.',
    '{name} is keeping an eye on the supper table and a sharper one on the conversation. By the second dance you know she is a {trade}, and that she means to remain one.',
  ],
  'hearth.ball.social': [
    'The band is uneven, the supper is sound, and for one evening the diggings remember that society is made of something besides claims and prices.',
  ],
  'hearth.addresses': [
    'You ask {name} whether you may call when you are next at Port Gannet. She says that you may, and names the days herself.',
  ],
  'hearth.call.kept': [
    'You keep the evening with {name}: tea with her people, a walk where the harbour wind clears the coal smoke, and talk in which the goldfields are neither romance nor disgrace.',
  ],
  'hearth.gift.small': [
    'The small parcel is useful, which is the best that can be said of a present, and it is received in that spirit.',
  ],
  'hearth.gift.lavish': [
    '{name} accepts the generosity without mistaking it for an argument. The matter is not mentioned again.',
  ],
  'hearth.gift.pressed': [
    '{name} puts the parcel back into your hands. “I am nobody’s purchase,” she says, quietly enough that nobody else need hear it.',
  ],
  'hearth.consent.yes': [
    '{name} has considered the life itself, not its prospectus, and says yes. The banns may be read when you are next at Port Gannet.',
  ],
  'hearth.consent.no': [
    '{name} gives her answer plainly and with reasons of her own. It is no, and no sum spent before it alters the word.',
  ],
  'hearth.banns.refused.record': [
    'Her family have the newspaper before them. Until your record is no worse than a petty offence, they will hear no banns read under their roof.',
  ],
  'hearth.banns': [
    'The banns are read at Port Gannet. {name} hears them without lowering her eyes, and corrects the clerk when he mispronounces your name.',
  ],
  'hearth.wedding': [
    'The wedding costs {amount}, feeds the people who stood by you, and makes no pretence that {name} has given up her own work. By nightfall the harbour has drunk your health.',
  ],
  'hearth.cottage': [
    'For {amount} there is a deed, a sound roof in Port Gannet and a floorboard that lifts. It is not grand. It is home because the two of you call it so.',
  ],
  'hearth.consign': [
    'Bell’s Freight takes {n} chest(s) down to the port. Her account comes back exact: {amount}, cleared without your making the journey.',
  ],
  'hearth.remit': [
    'The post-office clerk makes out the order for {amount}. It buys no favour and settles no debt; it says only that the gold was got for something.',
  ],
  'hearth.letters.read': [
    'The penny is paid and the letters from {name} are put into your hand, worn at the folds from having travelled farther than most people here ever will.',
  ],
  'hearth.event.christmas': [
    'Christmas at the hearth is a pudding that almost holds together, neighbours through the door, and {name} keeping one place clear until you fill it.',
  ],
  'hearth.event.birth': [
    'The child is born before dawn. By breakfast {name} is tired, exacting and entirely herself; the new life has no opinion yet of gold.',
  ],
  'hearth.event.sickbed': [
    'You are there through the fever, fetching the doctor and doing badly all the useful things that must nevertheless be done. By morning the danger has turned.',
  ],
  'hearth.estranged.missed': [
    '{name} has counted the promised dates and the empty chair. Her letter releases you from a future she will no longer wait to begin.',
  ],
  'hearth.estranged.record': [
    '{name} has read the account of your record and ends the understanding in her own hand. She will not be carried down that road.',
  ],
  'hearth.reconciled': [
    'A month in Port Gannet is not an apology made once but presence proved daily. {name} agrees that the household may begin again, with the old score closed rather than erased.',
  ],
  'hearth.final.none': ['No letter waits at the end of the year. You came out alone and remain answerable only to yourself.'],
  'hearth.final.intended': ['The final letter is warm but practical: dates kept, dates missed, and the question of what comes after the diggings.'],
  'hearth.final.settled': ['The last letter calls the cottage home without ceremony. That one word is the part of the year no bank draft records.'],
  'hearth.final.estranged': ['The last letter is not cruel. It is final, which is harder, and asks that no answer be sent.'],
};
