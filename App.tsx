import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Suit, Rank } from './types';
import type { Card, HandEvaluation, DealerAction } from './types';
import { generateGameImages, getDealerAction, determineWinner, generateGameOverImage, generateVictoryImage } from './services/geminiService';
import CardComponent from './components/Card';
import LoadingSpinner from './components/LoadingSpinner';

const createDeck = (): Card[] => {
  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Pre-canned dealer remarks to save API quota
const remarks = {
  bet: [
    "Ставлю. Посмотрим, есть ли у тебя что-то серьезное.",
    "Время поднять ставки. Буквально.",
    "Думаю, тебе стоит сбросить карты.",
    "Надеюсь, ты готов к этому.",
    "Давлю на тебя. Справишься?"
  ],
  check: [
    "Чек. Пока не вижу смысла рисковать.",
    "Проверяю. Мяч на твоей стороне.",
    "Хм, чек. Даю тебе шанс сделать ход.",
    "Посмотрим следующую карту бесплатно.",
    "Чек. Что дальше?"
  ],
  call: [
    "Уравниваю. Не так-то просто меня напугать.",
    "Колл. Посмотрим, к чему это приведет.",
    "Я в игре. Твою ставку принимаю.",
    "Хорошо, я уравниваю.",
    "Интересно... Колл."
  ],
  fold: [
    "Нет, на это я не подпишусь. Пас.",
    "Слишком рискованно. Я сбрасываю.",
    "Эти карты мне не нравятся. Фолд.",
    "Уступаю. Этот банк твой.",
    "Лучше сбросить сейчас, чем жалеть потом. Пас."
  ],
  win: [
    "Как и ожидалось, казино всегда в плюсе.",
    "Дом всегда выигрывает. Запомни это.",
    "Красивая игра, но опыт победил.",
    "Иногда удача просто на моей стороне.",
    "Лучше в следующий раз. Для тебя."
  ],
  lose: [
    "В этот раз повезло тебе... Наслаждайся.",
    "Ух, пронесло тебя! Мои поздравления.",
    "Ладно-ладно, твой раунд. Но я отыграюсь.",
    "Наслаждайся победой, пока можешь.",
    "Что ж, даже я иногда проигрываю."
  ],
  tie: [
    "Ничья. Такое бывает редко, разделим банк.",
    "Поделим, так и быть.",
    "Наши силы равны. Ничья."
  ]
};

const getRandomRemark = (category: keyof typeof remarks): string => {
  const categoryRemarks = remarks[category];
  return categoryRemarks[Math.floor(Math.random() * categoryRemarks.length)];
};


const App: React.FC = () => {
  const INITIAL_CHIPS = 1000;

  const [gameState, setGameState] = useState<GameState>(GameState.LoadingImage);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [dealerImages, setDealerImages] = useState<string[]>([]);
  
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  
  const [playerChips, setPlayerChips] = useState(INITIAL_CHIPS);
  const [dealerChips, setDealerChips] = useState(INITIAL_CHIPS);
  const [pot, setPot] = useState(0);
  
  const [playerBet, setPlayerBet] = useState(0);
  const [dealerBet, setDealerBet] = useState(0);

  const [betInputValue, setBetInputValue] = useState('50');

  const [message, setMessage] = useState<string>('');
  const [roundWinnerInfo, setRoundWinnerInfo] = useState<HandEvaluation | null>(null);
  const [isDealerThinking, setIsDealerThinking] = useState(false);

  const [gameOverImageUrl, setGameOverImageUrl] = useState<string>('');
  const [victoryImageUrl, setVictoryImageUrl] = useState<string>('');

  const handleResetGame = useCallback(() => {
    setPlayerChips(INITIAL_CHIPS);
    setDealerChips(INITIAL_CHIPS);
    setPot(0);
    setPlayerBet(0);
    setDealerBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setCommunityCards([]);
    setRoundWinnerInfo(null);
    setGameOverImageUrl('');
    setVictoryImageUrl('');
    if (dealerImages.length > 0) {
      const newDealerUrl = dealerImages[Math.floor(Math.random() * dealerImages.length)];
      setBackgroundImageUrl(newDealerUrl);
    }
    setGameState(GameState.Ready);
    setMessage('Добро пожаловать за стол AI Texas Hold\'em.');
  }, [dealerImages]);


  useEffect(() => {
    const initGame = async () => {
      setGameState(GameState.LoadingImage);
      setMessage('Создаем для вас эксклюзивную покерную комнату...');
      const generatedImages = await generateGameImages();
      setDealerImages(generatedImages);
      if (generatedImages.length > 0) {
        setBackgroundImageUrl(generatedImages[0]);
      }
      setGameState(GameState.Ready);
      setMessage('Добро пожаловать за стол AI Texas Hold\'em.');
    };
    initGame();
  }, []);

  const advanceGameStage = useCallback(async (isRoundOver = false) => {
    if (isRoundOver) {
        let nextState: GameState;
        const d = [...deck];
        
        if (communityCards.length === 0) {
            nextState = GameState.Flop;
            setCommunityCards([d.pop()!, d.pop()!, d.pop()!]);
        } else if (communityCards.length === 3) {
            nextState = GameState.Turn;
            setCommunityCards(cc => [...cc, d.pop()!]);
        } else if (communityCards.length === 4) {
            nextState = GameState.River;
            setCommunityCards(cc => [...cc, d.pop()!]);
        } else {
            nextState = GameState.Showdown;
        }
        setDeck(d);

        if (nextState !== GameState.Showdown) {
            setPlayerBet(0);
            setDealerBet(0);
            setBetInputValue('20');
            setMessage('Круг торгов завершен. Ваш ход.');
            setGameState(GameState.PlayerTurn);
        } else {
            setGameState(GameState.Showdown);
        }
    }
  }, [deck, communityCards.length]);
  
  const startNewRound = useCallback(() => {
    if (playerChips <= 0) {
      setGameState(GameState.GameOver);
      return;
    }
    if (dealerChips <= 0) {
      setGameState(GameState.Victory);
      return;
    }

    if (dealerImages.length > 0) {
      const newDealerUrl = dealerImages[Math.floor(Math.random() * dealerImages.length)];
      setBackgroundImageUrl(newDealerUrl);
    }

    const newDeck = shuffleDeck(createDeck());
    
    setPlayerHand([newDeck.pop()!, newDeck.pop()!]);
    setDealerHand([newDeck.pop()!, newDeck.pop()!]);
    setCommunityCards([]);
    setDeck(newDeck);
    
    const smallBlind = 10;
    const bigBlind = 20;

    const pChips = playerChips > smallBlind ? playerChips - smallBlind : 0;
    const pBet = playerChips > smallBlind ? smallBlind : playerChips;
    const dChips = dealerChips > bigBlind ? dealerChips - bigBlind : 0;
    const dBet = dealerChips > bigBlind ? bigBlind : dealerChips;

    setPlayerChips(pChips);
    setDealerChips(dChips);
    setPlayerBet(pBet);
    setDealerBet(dBet);
    setPot(pBet + dBet);
    
    setBetInputValue(String(bigBlind * 2));
    setGameState(GameState.PreFlop);
    setMessage(`Блайнды поставлены. Ваш ход. Уравняйте ${dBet - pBet}, повысьте или сбросьте.`);
    setRoundWinnerInfo(null);
  }, [playerChips, dealerChips, dealerImages]);

  const runItOut = useCallback(() => {
    const newDeck = [...deck];
    const cardsToDeal = 5 - communityCards.length;
    const dealtCards = [];
    for (let i = 0; i < cardsToDeal; i++) {
        if (newDeck.length > 0) {
            dealtCards.push(newDeck.pop()!);
        }
    }
    setDeck(newDeck);
    setTimeout(() => {
        setCommunityCards(cc => [...cc, ...dealtCards]);
        setGameState(GameState.Showdown);
    }, 1000);
  }, [deck, communityCards.length]);

  const handlePlayerAction = async (action: 'CALL' | 'RAISE' | 'FOLD' | 'CHECK' | 'ALL_IN') => {
    const betDifference = dealerBet - playerBet;

    if (action === 'FOLD') {
      const finalDealerChips = dealerChips + pot;
      setDealerChips(finalDealerChips);
      setMessage('Вы сбросили карты. Диллер забирает банк.');

      if (playerChips <= 0) {
          setGameState(GameState.GameOver);
      } else {
          setGameState(GameState.RoundOver);
      }
      return;
    }
    
    if (action === 'CHECK') {
      if (betDifference > 0) {
          setMessage(`Вы не можете сделать чек, нужно ответить на ставку в ${betDifference}.`);
          return;
      }
      setMessage('Вы сделали чек. Диллер думает...');
      setGameState(GameState.DealerTurn);
      return;
    }

    if (action === 'CALL') {
        if (betDifference <= 0) {
          setMessage('Нечего уравнивать. Вам следует сделать чек.');
          return;
        }
        const callAmount = Math.min(betDifference, playerChips);
        setPlayerChips(pc => pc - callAmount);
        setPot(p => p + callAmount);
        setPlayerBet(pb => pb + callAmount);
        
        if (dealerChips === 0 || (playerChips - callAmount) <= 0) {
            setMessage(`Вы уравняли олл-ин на ${callAmount}. Вскрываем все карты...`);
            runItOut();
        } else {
             setMessage(`Вы уравняли ${callAmount}.`);
            await advanceGameStage(true);
        }
        return;
    }
    
    if (action === 'ALL_IN') {
        const amountToAdd = playerChips;
        const totalBet = playerBet + amountToAdd;
        setPlayerChips(0);
        setPot(p => p + amountToAdd);
        setPlayerBet(totalBet);
        setMessage(`Вы идете олл-ин с ${totalBet}! Диллер думает...`);
        setGameState(GameState.DealerTurn);
        return;
    }

    if (action === 'RAISE') {
        const totalBetAmount = Number(betInputValue);
        const minRaiseAmount = dealerBet + (betDifference > 0 ? betDifference : 20);

        if(totalBetAmount < minRaiseAmount && (playerChips + playerBet) > minRaiseAmount) {
            setMessage(`Ваше повышение должно быть как минимум до ${minRaiseAmount}.`);
            return;
        }
        const amountToAdd = totalBetAmount - playerBet;
        if (amountToAdd > playerChips) {
            setMessage('Вы не можете поставить больше фишек, чем у вас есть.');
            return;
        }
        
        setPlayerChips(pc => pc - amountToAdd);
        setPot(p => p + amountToAdd);
        setPlayerBet(totalBetAmount);

        setMessage(`Вы повысили до ${totalBetAmount}. Диллер думает...`);
        setGameState(GameState.DealerTurn);
    }
  };
  
  useEffect(() => {
    if (gameState === GameState.DealerTurn) {
        const handleDealerTurn = async () => {
            setIsDealerThinking(true);
            const betToCall = playerBet - dealerBet;
            
            const action = await getDealerAction(dealerHand, communityCards, pot, betToCall, dealerChips, playerChips);
            let dealerMsg = '';
            
            switch (action.action) {
                case 'FOLD':
                    dealerMsg = `Диллер: "${getRandomRemark('fold')}" Диллер сбросил карты. Вы забираете банк!`;
                    setPlayerChips(pc => pc + pot);
                    setMessage(dealerMsg);
                    setGameState(GameState.RoundOver);
                    break;
                case 'CHECK':
                    dealerMsg = `Диллер: "${getRandomRemark('check')}" Диллер чекает.`;
                    setMessage(dealerMsg);
                    await advanceGameStage(true);
                    break;
                case 'CALL':
                    const callAmount = Math.min(betToCall, dealerChips);
                    dealerMsg = `Диллер: "${getRandomRemark('call')}" `;
                    setDealerChips(dc => dc - callAmount);
                    setPot(p => p + callAmount);
                    setDealerBet(db => db + callAmount);
                    
                    if (playerChips === 0 || (dealerChips - callAmount) <= 0) {
                        setMessage(dealerMsg + 'Диллер уравнивает олл-ин! Вскрываем все карты...');
                        runItOut();
                    } else {
                        setMessage(dealerMsg + 'Диллер уравнивает.');
                        await advanceGameStage(true);
                    }
                    break;
                case 'RAISE':
                case 'BET':
                    dealerMsg = `Диллер: "${getRandomRemark('bet')}" `;
                    const totalBetAmount = Math.min(action.amount || playerBet * 2, dealerChips + dealerBet);
                    const amountToAdd = totalBetAmount - dealerBet;
                     if (amountToAdd <= 0 || totalBetAmount < playerBet) { // Invalid bet/raise from AI
                        if (betToCall > 0) {
                           const fallbackCall = Math.min(betToCall, dealerChips);
                            setDealerChips(dc => dc - fallbackCall);
                            setPot(p => p + fallbackCall);
                            setDealerBet(db => db + fallbackCall);
                            setMessage(`Диллер: "${getRandomRemark('call')}" Диллер уравнивает.`);
                            await advanceGameStage(true);
                        } else {
                            setMessage(`Диллер: "${getRandomRemark('check')}" Диллер чекает.`);
                            await advanceGameStage(true);
                        }
                    } else {
                        setDealerChips(dc => dc - amountToAdd);
                        setPot(p => p + amountToAdd);
                        setDealerBet(totalBetAmount);
                        setMessage(dealerMsg + `Диллер ставит ${totalBetAmount}. Ваш ход.`);
                        setGameState(GameState.PlayerTurn);
                    }
                    break;
            }
            setIsDealerThinking(false);
        };
        handleDealerTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, playerChips, dealerChips, playerBet, dealerBet, pot, communityCards, dealerHand, advanceGameStage, runItOut]);
  
  useEffect(() => {
    if (gameState === GameState.Showdown) {
      const doShowdown = async () => {
          setIsDealerThinking(true);
          setMessage('Вскрытие карт! Определяем победителя...');
          const result = await determineWinner(playerHand, dealerHand, communityCards);
          
          let winnerMsg = '';
          let finalPlayerChips = playerChips;
          let finalDealerChips = dealerChips;
          let remark = '';

          if (result.winner === 'PLAYER') {
              winnerMsg = `Вы выиграли с ${result.winningHandName}!`;
              finalPlayerChips += pot;
              remark = getRandomRemark('lose');
          } else if (result.winner === 'DEALER') {
              winnerMsg = `Диллер выиграл с ${result.winningHandName}.`;
              finalDealerChips += pot;
              remark = getRandomRemark('win');
          } else {
              winnerMsg = `Ничья! Банк разделен. Комбинация: ${result.winningHandName}.`;
              finalPlayerChips += Math.floor(pot / 2);
              finalDealerChips += Math.ceil(pot / 2);
              remark = getRandomRemark('tie');
          }
          
          const fullResult: HandEvaluation = {...result, remark };
          setRoundWinnerInfo(fullResult);
          
          setMessage(`${winnerMsg} Диллер: "${remark}"`);
          setPlayerChips(finalPlayerChips);
          setDealerChips(finalDealerChips);
          
          setIsDealerThinking(false);
          
          if (finalDealerChips <= 0) {
              setGameState(GameState.Victory);
          } else if (finalPlayerChips <= 0) {
              setGameState(GameState.GameOver);
          } else {
              setGameState(GameState.RoundOver);
          }
      };
      doShowdown();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, playerHand, dealerHand, communityCards, pot]);

  useEffect(() => {
    if (gameState === GameState.GameOver && !gameOverImageUrl) {
        const getGameOverImage = async () => {
            setMessage('Генерируем экран поражения...');
            const url = await generateGameOverImage();
            setGameOverImageUrl(url);
        };
        getGameOverImage();
    }
  }, [gameState, gameOverImageUrl]);

  useEffect(() => {
      if (gameState === GameState.Victory && !victoryImageUrl) {
          const getVictoryImg = async () => {
              setMessage('Генерируем экран победы...');
              const url = await generateVictoryImage();
              setVictoryImageUrl(url);
          };
          getVictoryImg();
      }
  }, [gameState, victoryImageUrl]);


  const renderControls = () => {
    if (gameState === GameState.Ready) {
        return <button onClick={startNewRound} className="px-8 py-4 bg-yellow-500 text-gray-900 font-bold rounded-lg shadow-lg hover:bg-yellow-400 transition-all text-2xl">Начать игру</button>;
    }
    if (gameState === GameState.RoundOver) {
        return <button onClick={startNewRound} disabled={isDealerThinking} className="px-8 py-4 bg-yellow-500 text-gray-900 font-bold rounded-lg shadow-lg hover:bg-yellow-400 transition-all text-2xl disabled:bg-gray-500 disabled:cursor-not-allowed">Следующий раунд</button>;
    }

    if (gameState === GameState.PlayerTurn || gameState === GameState.PreFlop) {
      const BIG_BLIND = 20;
      const callAmount = dealerBet - playerBet;
      const lastBetSize = callAmount > 0 ? callAmount : BIG_BLIND;
      const minRaiseTotal = dealerBet + lastBetSize;
      const playerEffectiveStack = playerChips + playerBet;
      const inputMin = Math.min(callAmount > 0 ? minRaiseTotal : BIG_BLIND, playerEffectiveStack);
      const inputMax = playerEffectiveStack;

      const handleBetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setBetInputValue(value);
        }
      };
      
      const handleBetInputBlur = () => {
        const numValue = Number(betInputValue);
        const clampedValue = Math.min(inputMax, Math.max(inputMin, numValue || inputMin));
        setBetInputValue(String(clampedValue));
      };

      return (
          <div className="w-full max-w-xl flex flex-col items-center space-y-3">
              <div className="flex items-center space-x-2 md:space-x-4">
                  <button onClick={() => handlePlayerAction('FOLD')} className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-500 transition-all">Сбросить</button>
                  {callAmount <= 0 ? 
                    <button onClick={() => handlePlayerAction('CHECK')} className="px-6 py-3 bg-gray-500 text-white font-bold rounded-lg shadow-md hover:bg-gray-400 transition-all">Чек</button>
                    :
                    <button onClick={() => handlePlayerAction('CALL')} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-500 transition-all">Уравнять ({callAmount})</button>
                  }
                   <button onClick={() => handlePlayerAction('ALL_IN')} disabled={playerChips <= 0} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-500 transition-all disabled:bg-gray-500">Олл-ин</button>
              </div>
               <div className="flex items-center w-full space-x-3 bg-black bg-opacity-50 p-2 rounded-lg">
                  <button onClick={() => handlePlayerAction('RAISE')} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-500 transition-all">{callAmount > 0 ? 'Рейз до' : 'Ставка'}</button>
                  <input 
                      type="range"
                      min={inputMin}
                      max={inputMax}
                      value={betInputValue}
                      onChange={e => setBetInputValue(e.target.value)}
                      onMouseUp={handleBetInputBlur}
                      onTouchEnd={handleBetInputBlur}
                      step="1"
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer thumb:bg-white"
                      style={{accentColor: 'rgb(34 197 94)'}}
                  />
                  <input 
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      value={betInputValue}
                      onChange={handleBetInputChange}
                      onBlur={handleBetInputBlur}
                      className="w-28 px-2 py-2 text-center bg-gray-800 text-white font-bold rounded-lg border-2 border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
              </div>
          </div>
      );
    }
    
    return null;
  };
  
  const showDealerHand = gameState === GameState.Showdown || (gameState === GameState.RoundOver && !!roundWinnerInfo);

  if (gameState === GameState.GameOver || gameState === GameState.Victory) {
    const isGameOver = gameState === GameState.GameOver;
    const imageUrl = isGameOver ? gameOverImageUrl : victoryImageUrl;
    const title = isGameOver ? 'Вы всё проиграли!' : 'Поздравляем с победой!';

    return (
        <div className="relative w-full h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
            {imageUrl ? (
                <img src={imageUrl} alt={title} className="absolute top-0 left-0 w-full h-full object-contain z-0" />
            ) : (
                <div className="absolute top-0 left-0 w-full h-full bg-gray-800 z-0 flex items-center justify-center">
                    <LoadingSpinner message={message} />
                </div>
            )}
            <div className="relative z-10 flex flex-col items-center justify-center bg-black bg-opacity-70 p-8 rounded-lg shadow-2xl">
                <h1 className="text-5xl font-bold mb-6 text-yellow-400">{title}</h1>
                <button 
                    onClick={handleResetGame} 
                    className="px-10 py-5 bg-yellow-500 text-gray-900 font-bold rounded-lg shadow-lg hover:bg-yellow-400 transition-all text-3xl">
                    Начать заново
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-900 text-white font-sans overflow-hidden">
      {backgroundImageUrl ? 
        <img src={backgroundImageUrl} alt="Poker Table" className="absolute top-0 left-0 w-full h-full object-contain z-0" />
        :
        <div className="absolute top-0 left-0 w-full h-full bg-gray-800 z-0 flex items-center justify-center">
          {gameState === GameState.LoadingImage && <LoadingSpinner message={message} />}
        </div>
      }
      <button 
        onClick={handleResetGame}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-500 transition-all text-sm">
        Начать заново
      </button>

      {/* Main Game Layout */}
      <div className="relative z-20 flex flex-col h-full">
        {/* Header Area */}
        <div className="w-full p-3 bg-black bg-opacity-80 shadow-lg flex justify-around items-center gap-4">
            <div className="p-3 bg-gray-800 rounded-full text-2xl font-bold text-yellow-300 shadow-lg whitespace-nowrap">
                Банк: {pot}
            </div>
            <div className="text-center p-3 w-full max-w-3xl bg-black bg-opacity-70 rounded-lg shadow-xl min-h-[60px] flex items-center justify-center">
                {isDealerThinking ? <LoadingSpinner /> : <p className="text-lg font-semibold">{message}</p>}
            </div>
        </div>
        
        {/* Game Board Area */}
        <div className="flex-grow flex flex-col items-center justify-around p-4">
            {/* Dealer Area */}
            <div className="flex flex-col items-center">
                <div className="flex items-center space-x-2">
                    <h2 className="text-xl md:text-2xl font-bold">Диллер</h2>
                    <div className="px-4 py-1 bg-gray-800 bg-opacity-80 rounded-full text-lg font-semibold text-yellow-300">
                        {dealerChips} фишек
                    </div>
                </div>
                <div className="flex space-x-2 mt-2 min-h-[112px] md:min-h-[144px]">
                    {dealerHand.map((card, index) => <CardComponent key={index} card={{...card, isFaceDown: !showDealerHand}} />)}
                </div>
                {dealerBet > 0 && <div className="mt-2 px-3 py-1 bg-red-700 bg-opacity-80 rounded-full text-md font-semibold">Ставка: {dealerBet}</div>}
            </div>

            {/* Community Cards & Winner Info */}
            <div className="flex flex-col items-center space-y-2">
                <div className="flex space-x-2 justify-center min-h-[112px] md:min-h-[144px]">
                    {communityCards.map((card, index) => <CardComponent key={index} card={card} />)}
                </div>
                 {roundWinnerInfo && showDealerHand && (
                    <div className="text-center p-2 bg-black bg-opacity-60 rounded-lg">
                        <p className="font-bold text-lg text-yellow-400">{roundWinnerInfo.winningHandName}</p>
                        <p className="text-sm">{roundWinnerInfo.winningHandDescription}</p>
                    </div>
                )}
            </div>
        </div>

        {/* Player Panel Area */}
        <div className="w-full p-4 bg-black bg-opacity-75 rounded-t-xl shadow-[0_-4px_15px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col items-center w-full">
                <div className="flex items-center space-x-2">
                    <h2 className="text-xl md:text-2xl font-bold">Игрок</h2>
                    <div className="px-4 py-1 bg-gray-800 bg-opacity-80 rounded-full text-lg font-semibold text-yellow-300">
                        {playerChips} фишек
                    </div>
                </div>
                <div className="flex space-x-2 mt-2 min-h-[112px] md:min-h-[144px]">
                    {playerHand.map((card, index) => <CardComponent key={index} card={card} />)}
                </div>
                {playerBet > 0 && <div className="mt-2 px-3 py-1 bg-green-700 bg-opacity-80 rounded-full text-md font-semibold">Ставка: {playerBet}</div>}
                <div className="mt-4 w-full flex justify-center">
                  {renderControls()}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
