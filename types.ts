export enum Suit {
  Hearts = '♥',
  Diamonds = '♦',
  Clubs = '♣',
  Spades = '♠',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = 'T',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  isFaceDown?: boolean;
}

export enum GameState {
  LoadingImage = 'LOADING_IMAGE',
  Ready = 'READY',
  PreFlop = 'PRE_FLOP',
  PlayerTurn = 'PLAYER_TURN',
  DealerTurn = 'DEALER_TURN',
  Flop = 'FLOP',
  Turn = 'TURN',
  River = 'RIVER',
  Showdown = 'SHOWDOWN',
  RoundOver = 'ROUND_OVER',
  GameOver = 'GAME_OVER',
  Victory = 'VICTORY',
}

export interface HandEvaluation {
  winner: 'PLAYER' | 'DEALER' | 'TIE';
  winningHandName: string;
  winningHandDescription: string;
  remark?: string; // Dealer's comment on the outcome
}

export interface DealerAction {
  action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE';
  amount?: number;
  remark?: string; // Dealer's taunt or comment during their turn
}