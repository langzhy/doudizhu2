export enum Difficulty {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
}

export enum Suit {
  SPADE = '♠',
  HEART = '♥',
  CLUB = '♣',
  DIAMOND = '♦',
  JOKER = 'J',
}

export enum Rank {
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14,
  TWO = 15,
  SMALL_JOKER = 16,
  BIG_JOKER = 17,
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  label: string;
}

export enum GamePhase {
  WAITING = 'WAITING',
  DEALING = 'DEALING',
  BIDDING = 'BIDDING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum PlayerRole {
  LANDLORD = 'LANDLORD',
  PEASANT = 'PEASANT',
  UNDECIDED = 'UNDECIDED',
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  role: PlayerRole;
  isAI: boolean;
  score: number;
}

export enum CardType {
  INVALID = 'INVALID',
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  TRIPLE_ONE = 'TRIPLE_ONE',
  TRIPLE_PAIR = 'TRIPLE_PAIR',
  STRAIGHT = 'STRAIGHT',
  DOUBLE_STRAIGHT = 'DOUBLE_STRAIGHT',
  AIRPLANE = 'AIRPLANE',
  AIRPLANE_WINGS = 'AIRPLANE_WINGS',
  QUAD_TWO = 'QUAD_TWO',
  BOMB = 'BOMB',
  ROCKET = 'ROCKET',
}

export interface PlayResult {
  type: CardType;
  rank: number; // Primary rank for comparison
  length: number; // For straights/airplanes
  cards: Card[];
}
