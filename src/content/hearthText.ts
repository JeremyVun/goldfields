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
    'Between dances you are presented to {name}, a {trade} lately of Port Gannet. She has heard every goldfields story a man can tell, and listens to yours as though it had better be true.',
  ],
  'hearth.ball.social': [
    'The band is uneven, the supper is sound, and for one evening the diggings remember that society is made of something besides claims and prices.',
    'You dance twice, lose a shilling on the supper raffle, and hear more sense talked in one evening than the diggings manage in a month.',
    'The Assembly Room is hot, the fiddler is game, and by the last set the flags overhead have shed half their gum leaves onto the dancers below.',
  ],
  'hearth.addresses': [
    'You ask {name} whether you may call when you are next at Port Gannet. She says that you may, and names the days herself.',
    '“You may,” says {name}, in the tone of a woman who decided some minutes ago and has merely let you catch up. Her letter will name the days.',
  ],
  'hearth.call.kept': [
    'You keep the evening with {name}: tea with her people, a walk where the harbour wind clears the coal smoke, and talk in which the goldfields are neither romance nor disgrace.',
    'The evening is spent at {name}’s table, where her people take your measure over cold mutton and hot tea, and she rescues you twice from her uncle’s opinions on the licence question.',
    'You walk the esplanade with {name} while the fishing boats come in. She points out which captains still have crews, and laughs — once, briefly — at something you had not known was funny until she found it so.',
    '{name} shows you the books she keeps, neat columns with no romance in them, and asks sensible questions about the fields that you answer rather less sensibly than you would like.',
    'Rain keeps the party indoors, and the evening is cards with her people, the harbour lamps through wet glass, and {name} winning steadily without appearing to try.',
  ],
  'hearth.gift.small': [
    'The small parcel is useful, which is the best that can be said of a present, and it is received in that spirit.',
    'You bring what her work actually wants rather than what a jeweller imagined. {name} looks at it, then at you, and observes that you have been paying attention.',
  ],
  'hearth.gift.lavish': [
    '{name} accepts the generosity without mistaking it for an argument. The matter is not mentioned again.',
    'It is a great deal, and {name} knows to the shilling how much. She thanks you once, properly, and puts it away; the subject does not come up at supper.',
  ],
  'hearth.gift.pressed': [
    '{name} puts the parcel back into your hands. “I am nobody’s purchase,” she says, quietly enough that nobody else need hear it.',
    '{name} looks at the second parcel inside the month and does not take it. “I am nobody’s purchase,” she says, and pours the tea as though nothing had been said.',
  ],
  'hearth.consent.yes': [
    '{name} has considered the life itself, not its prospectus, and says yes. The banns may be read when you are next at Port Gannet.',
    '{name} says yes. She has thought about it longer than you have, weighed it against a life she already liked, and says yes anyway; the banns can be read when you are next at the port.',
  ],
  'hearth.consent.no': [
    '{name} gives her answer plainly and with reasons of her own: it is no. She hopes the fields treat you fairly, and she means it.',
    'The answer is no. {name} does not dress it up or leave a door ajar; she thanks you for the evenings, and that is the whole of it.',
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
    'The post-office clerk makes out the order for {amount}, stamps it twice, and consigns it to the Port Gannet mail. What it was for, the next letter will say better than his ledger can.',
    '{amount} goes down to the port by post-office order. It will arrive before you do, which is rather the point.',
  ],
  'hearth.letters.read': [
    'The penny is paid and the letters from {name} are put into your hand, worn at the folds from having travelled farther than most people here ever will.',
    'A penny buys the bundle from {name}: harbour news, a neighbour’s scandal handled kindly, and between the lines the only question that matters, which is when.',
  ],
  'hearth.event.christmas': [
    'Christmas at the hearth is a pudding that almost holds together, neighbours through the door, and {name} keeping one place clear until you fill it.',
    'There is goose because the district ran out of turkey, a carol sung flat and meant entirely, and {name} leaving the year’s ledger shut in a drawer where it belongs.',
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

  // Letters set down in the mail itself, picked once and kept (sayFixed).
  'hearth.letter.summons': [
    '{name} writes that you are looked for at Port Gannet for {event}, any day between {from} and {to}. The rest of the page is harbour news, which is her way of not underlining it.',
    'A letter in a firm round hand: {event}, at Port Gannet, between {from} and {to}. There is a postscript about the price of flour, and none about what your absence would mean.',
    'The mail brings word from {name}: the household counts on you for {event}, between {from} and {to}. The wharves are full again, she writes, and the town smells of tar and oranges.',
  ],
  'hearth.letter.missed': [
    'The days appointed for {event} passed without you. No account is asked; the absence is account enough.',
    'A short letter follows the week set aside for {event}. It is civil, it is newsless, and its shortness says what it declines to say.',
    'The window for {event} closed on an empty chair. The next letter comes thinner, as though the harbour news had found somewhere better to be.',
  ],
  'hearth.letter.estranged.missed': [
    '{name} will not arrange a life around dates you do not keep. She releases you from the understanding, wishes you no ill, and signs her full name.',
    'The letter is brief, because everything in it has been said before, at the appointed times, to an empty chair. {name} ends the understanding and asks that you not make the journey to argue it.',
  ],
  'hearth.letter.estranged.record': [
    '{name} has read what the paper says of your record, and writes that she will not be carried further down that road. The letter is steady; the hand that wrote it was not, quite.',
    'The Gazette reached Port Gannet before your side of it could. {name} ends the understanding in her own hand, her reasons set out fairly and her mind entirely made up.',
  ],
  'hearth.letter.declined': [
    '{name} has considered the life you offer — honestly, she writes, and more than once — and declines it. Her answer is final, and it is her own.',
    'The letter sets out her reasons the way she keeps her books: plainly, in order, nothing hidden in the margins. The answer is no, and {name} wishes you well on the fields.',
  ],
  'hearth.letter.remit': [
    'Your post-office order for {amount} came safely, and was not needed, which you knew. The roof is sound, she writes; come and stand under it when you can.',
    'The order for {amount} arrived with the Tuesday mail. Half is put by, some has gone on her sister’s children’s boots, and the letter that says so is warmer than the arithmetic.',
    '{amount} received, the letter confirms, in a hand that then spends three sentences on the new curate and one on the money.',
  ],

  'hearth.final.none': ['No letter waits at the end of the year. You came out alone and remain answerable only to yourself.'],
  'hearth.final.intended': ['The final letter is warm but practical: dates kept, dates missed, and the question of what comes after the diggings.'],
  'hearth.final.settled': ['The last letter calls the cottage home without ceremony. That one word is the part of the year no bank draft records.'],
  'hearth.final.estranged': ['The last letter is not cruel. It is final, which is harder, and asks that no answer be sent.'],
};
