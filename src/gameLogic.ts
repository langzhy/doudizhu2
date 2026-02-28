import { Card, CardType, PlayResult, Rank } from './types';

export function getCardType(cards: Card[]): PlayResult {
  const len = cards.length;
  if (len === 0) return { type: CardType.INVALID, rank: 0, length: 0, cards };

  const sorted = [...cards].sort((a, b) => a.rank - b.rank);
  const counts: Record<number, number> = {};
  sorted.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
  const entries = Object.entries(counts).map(([rank, count]) => ({ rank: parseInt(rank), count }));
  entries.sort((a, b) => b.count !== a.count ? b.count - a.count : b.rank - a.rank);

  // Rocket
  if (len === 2 && sorted[0].rank === Rank.SMALL_JOKER && sorted[1].rank === Rank.BIG_JOKER) {
    return { type: CardType.ROCKET, rank: Rank.BIG_JOKER, length: 2, cards };
  }

  // Single
  if (len === 1) {
    return { type: CardType.SINGLE, rank: sorted[0].rank, length: 1, cards };
  }

  // Pair
  if (len === 2 && sorted[0].rank === sorted[1].rank) {
    return { type: CardType.PAIR, rank: sorted[0].rank, length: 1, cards };
  }

  // Bomb
  if (len === 4 && entries.length === 1 && entries[0].count === 4) {
    return { type: CardType.BOMB, rank: entries[0].rank, length: 1, cards };
  }

  // Triple
  if (len === 3 && entries.length === 1) {
    return { type: CardType.TRIPLE, rank: entries[0].rank, length: 1, cards };
  }

  // Triple with one
  if (len === 4 && entries[0].count === 3) {
    return { type: CardType.TRIPLE_ONE, rank: entries[0].rank, length: 1, cards };
  }

  // Triple with pair
  if (len === 5 && entries[0].count === 3 && entries[1].count === 2) {
    return { type: CardType.TRIPLE_PAIR, rank: entries[0].rank, length: 1, cards };
  }

  // Straight
  if (len >= 5) {
    let isStraight = true;
    for (let i = 0; i < len - 1; i++) {
      if (sorted[i+1].rank - sorted[i].rank !== 1 || sorted[i+1].rank >= Rank.TWO) {
        isStraight = false;
        break;
      }
    }
    if (isStraight) return { type: CardType.STRAIGHT, rank: sorted[0].rank, length: len, cards };
  }

  // Double Straight
  if (len >= 6 && len % 2 === 0) {
    let isDoubleStraight = true;
    for (let i = 0; i < len; i += 2) {
      if (sorted[i].rank !== sorted[i+1].rank || (i > 0 && sorted[i].rank - sorted[i-1].rank !== 1) || sorted[i].rank >= Rank.TWO) {
        isDoubleStraight = false;
        break;
      }
    }
    if (isDoubleStraight) return { type: CardType.DOUBLE_STRAIGHT, rank: sorted[0].rank, length: len / 2, cards };
  }

  // Airplane
  // Simplified: consecutive triples
  const triples = entries.filter(e => e.count === 3).sort((a, b) => a.rank - b.rank);
  if (triples.length >= 2) {
    let isConsecutive = true;
    for (let i = 0; i < triples.length - 1; i++) {
      if (triples[i+1].rank - triples[i].rank !== 1 || triples[i+1].rank >= Rank.TWO) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) {
      const tripleCount = triples.length;
      // Pure airplane
      if (len === tripleCount * 3) {
        return { type: CardType.AIRPLANE, rank: triples[0].rank, length: tripleCount, cards };
      }
      // Airplane with wings (singles)
      if (len === tripleCount * 4) {
        return { type: CardType.AIRPLANE_WINGS, rank: triples[0].rank, length: tripleCount, cards };
      }
      // Airplane with wings (pairs)
      if (len === tripleCount * 5) {
        const pairs = entries.filter(e => e.count === 2);
        if (pairs.length === tripleCount) {
          return { type: CardType.AIRPLANE_WINGS, rank: triples[0].rank, length: tripleCount, cards };
        }
      }
    }
  }

  // Quad with two
  if (len === 6 && entries[0].count === 4) {
    return { type: CardType.QUAD_TWO, rank: entries[0].rank, length: 1, cards };
  }
  if (len === 8 && entries[0].count === 4 && entries[1].count === 2 && entries[2].count === 2) {
    return { type: CardType.QUAD_TWO, rank: entries[0].rank, length: 1, cards };
  }

  return { type: CardType.INVALID, rank: 0, length: 0, cards };
}

export function canPlay(newPlay: PlayResult, lastPlay: PlayResult | null): boolean {
  if (newPlay.type === CardType.INVALID) return false;
  if (!lastPlay || lastPlay.type === CardType.INVALID) return true;

  // Rocket beats everything
  if (newPlay.type === CardType.ROCKET) return true;
  if (lastPlay.type === CardType.ROCKET) return false;

  // Bomb beats everything except Rocket and higher Bomb
  if (newPlay.type === CardType.BOMB) {
    if (lastPlay.type !== CardType.BOMB) return true;
    return newPlay.rank > lastPlay.rank;
  }
  if (lastPlay.type === CardType.BOMB) return false;

  // Same type and length
  if (newPlay.type === lastPlay.type && newPlay.length === lastPlay.length) {
    return newPlay.rank > lastPlay.rank;
  }

  return false;
}
