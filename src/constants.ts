import { Card, Rank, Suit } from './types';

export const RANKS = [
  Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN,
  Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE, Rank.TWO
];

export const SUITS = [Suit.SPADE, Suit.HEART, Suit.CLUB, Suit.DIAMOND];

export const RANK_LABELS: Record<Rank, string> = {
  [Rank.THREE]: '3',
  [Rank.FOUR]: '4',
  [Rank.FIVE]: '5',
  [Rank.SIX]: '6',
  [Rank.SEVEN]: '7',
  [Rank.EIGHT]: '8',
  [Rank.NINE]: '9',
  [Rank.TEN]: '10',
  [Rank.JACK]: 'J',
  [Rank.QUEEN]: 'Q',
  [Rank.KING]: 'K',
  [Rank.ACE]: 'A',
  [Rank.TWO]: '2',
  [Rank.SMALL_JOKER]: '小王',
  [Rank.BIG_JOKER]: '大王',
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;

  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({
        id: `card-${id++}`,
        suit,
        rank,
        label: RANK_LABELS[rank],
      });
    }
  }

  deck.push({
    id: `card-${id++}`,
    suit: Suit.JOKER,
    rank: Rank.SMALL_JOKER,
    label: RANK_LABELS[Rank.SMALL_JOKER],
  });

  deck.push({
    id: `card-${id++}`,
    suit: Suit.JOKER,
    rank: Rank.BIG_JOKER,
    label: RANK_LABELS[Rank.BIG_JOKER],
  });

  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return b.rank - a.rank;
    }
    return a.suit.localeCompare(b.suit);
  });
}
