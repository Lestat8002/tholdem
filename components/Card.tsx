
import React from 'react';
import type { Card as CardType } from '../types';
import { Suit } from '../types';

const CardComponent: React.FC<{ card: CardType }> = ({ card }) => {
  if (card.isFaceDown) {
    return (
      <div className="w-20 h-28 md:w-24 md:h-36 bg-blue-800 rounded-lg border-2 border-blue-400 flex items-center justify-center shadow-lg">
        <div className="w-16 h-24 md:w-20 md:h-32 rounded-md bg-blue-700 border-2 border-blue-400"></div>
      </div>
    );
  }

  const color = card.suit === Suit.Hearts || card.suit === Suit.Diamonds ? 'text-red-500' : 'text-black';

  return (
    <div className="relative w-20 h-28 md:w-24 md:h-36 bg-white rounded-lg p-1 flex justify-center items-center border-2 border-gray-300 shadow-lg">
      <div className={`absolute top-1 left-2 text-xl md:text-2xl font-bold ${color} leading-none text-center`}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
      
      <div className={`text-4xl md:text-5xl font-bold ${color}`}>
        {card.suit}
      </div>

      <div className={`absolute bottom-1 right-2 text-xl md:text-2xl font-bold ${color} leading-none text-center transform rotate-180`}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
    </div>
  );
};

export default CardComponent;
