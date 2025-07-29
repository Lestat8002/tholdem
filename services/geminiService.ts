import { GoogleGenAI, Type } from "@google/genai";
import type { Card, HandEvaluation, DealerAction } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cardToString = (card: Card): string => `${card.rank}${card.suit}`;

export const dealerPrompts = [
  'A perfectly centered medium shot of a beautiful anime-style Japanese hostess with long silver hair in a blue bunny costume as a poker dealer. She should be fully visible from the waist up behind the poker table. The viewpoint is from the player\'s perspective, looking across a green felt table. Casino background, elegant and vibrant. Art style: high-quality anime, detailed, dynamic lighting, cinematic framing.',
  'A perfectly centered medium shot of a cheerful anime-style Japanese hostess with short pink hair in a black bunny costume as a poker dealer. She should be fully visible from the waist up behind the poker table. The viewpoint is from the player\'s perspective, looking across a green felt table. Casino background, elegant and vibrant. Art style: high-quality anime, detailed, dynamic lighting, cinematic framing.',
  'A perfectly centered medium shot of an elegant anime-style Japanese hostess with braided blonde hair in a white bunny costume as a poker dealer. She should be fully visible from the waist up behind the poker table. The viewpoint is from the player\'s perspective, looking across a green felt table. Casino background, elegant and vibrant. Art style: high-quality anime, detailed, dynamic lighting, cinematic framing.'
];

export const generateGameImages = async (): Promise<string[]> => {
  const imagePromises = dealerPrompts.map(prompt => 
      ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9',
          },
      })
  );

  try {
    const responses = await Promise.all(imagePromises);
    const urls = responses.map(response => {
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return "https://picsum.photos/1920/1080?blur=5"; // Fallback
    });
    const validUrls = urls.filter(url => !url.includes("picsum.photos"));
    return validUrls.length > 0 ? validUrls : dealerPrompts.map(() => "https://picsum.photos/1920/1080?blur=5");
  } catch (error) {
    console.error("Error generating images:", error);
    return dealerPrompts.map(() => "https://picsum.photos/1920/1080?blur=5");
  }
};

export const getDealerAction = async (dealerHand: Card[], communityCards: Card[], pot: number, betToCall: number, dealerChips: number, playerChips: number): Promise<Omit<DealerAction, 'remark'>> => {
  const systemInstruction = `Вы — эксперт по Техасскому Холдему и играете против человека. Ваша цель — действовать стратегически. Проанализируйте состояние игры и выберите лучшее действие. Доступные действия: FOLD, CHECK, CALL, BET, RAISE.
- Вы должны сделать CHECK, если нет ставки для ответа (betToCall равен 0).
- Вы должны сделать CALL или FOLD, если есть ставка. Вы также можете сделать RAISE.
- Если вы делаете BET или RAISE, укажите сумму. Сумма ставки должна быть разумной, например, от половины до полного размера банка. Не ставьте больше фишек, чем у вас есть. Хороший рейз обычно составляет от 2x до 3x предыдущей ставки.
- Верните ваше решение в виде JSON-объекта с полями 'action' и опционально 'amount'.`;

  const prompt = `
    Game State:
    - Your Hand: [${dealerHand.map(cardToString).join(', ')}]
    - Community Cards: [${communityCards.map(cardToString).join(', ')}]
    - Current Pot: ${pot} chips
    - Your Chips: ${dealerChips}
    - Opponent's Chips: ${playerChips}
    - Amount to Call: ${betToCall} chips

    What is your action? If you BET or RAISE, what is the total amount of your bet for this round?
    `;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            temperature: 0.9,
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    action: { type: Type.STRING, enum: ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE']},
                    amount: { type: Type.NUMBER },
                },
                required: ['action']
            },
        }
    });

    const actionData = JSON.parse(response.text) as DealerAction;
    
    // Basic validation of AI response
    if (betToCall > 0 && actionData.action === 'CHECK') {
        actionData.action = dealerChips > betToCall ? 'CALL' : 'FOLD'; // Can't check when there's a bet, so call or fold.
    }
    if (betToCall === 0 && (actionData.action === 'CALL' || actionData.action === 'FOLD')) {
        actionData.action = 'CHECK';
    }
    if ((actionData.action === 'BET' || actionData.action === 'RAISE') && (!actionData.amount || actionData.amount <= betToCall)) {
        actionData.action = betToCall > 0 ? 'RAISE' : 'BET';
        actionData.amount = betToCall > 0 ? betToCall * 2 : Math.floor(pot / 2);
    }
    if (actionData.amount && actionData.amount > dealerChips) {
        actionData.amount = dealerChips; // All-in
    }

    return actionData;

  } catch (error) {
    console.error("Error getting dealer action:", error);
    // Fallback action on error
    return { action: betToCall > 0 ? 'FOLD' : 'CHECK' };
  }
};

export const determineWinner = async (playerHand: Card[], dealerHand: Card[], communityCards: Card[]): Promise<Omit<HandEvaluation, 'remark'>> => {
    const systemInstruction = `Вы — судья по покеру в Техасском Холдеме. Учитывая руку игрока, руку дилера и общие карты, определите победителя. Верните JSON-объект с тремя полями: 'winner' ('PLAYER', 'DEALER' или 'TIE'), 'winningHandName' (например, 'Фулл-хаус') и 'winningHandDescription' (например, 'Тузы, полные королей').`;
    const prompt = `
    Player Hand: [${playerHand.map(cardToString).join(', ')}]
    Dealer Hand: [${dealerHand.map(cardToString).join(', ')}]
    Community Cards: [${communityCards.map(cardToString).join(', ')}]

    Who wins?
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.9,
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        winner: { type: Type.STRING, enum: ['PLAYER', 'DEALER', 'TIE']},
                        winningHandName: { type: Type.STRING },
                        winningHandDescription: { type: Type.STRING },
                    },
                    required: ['winner', 'winningHandName', 'winningHandDescription']
                }
            }
        });
        return JSON.parse(response.text) as HandEvaluation;
    } catch(error) {
        console.error("Error determining winner:", error);
        return {
            winner: 'TIE',
            winningHandName: 'Ошибка',
            winningHandDescription: 'Произошла ошибка при оценке руки.'
        };
    }
};

export const generateGameOverImage = async (): Promise<string> => {
  const prompt = "A funny, cartoonish splash art of a poker player who has lost everything. The character is centered in the frame. He's standing in his underwear with his pockets turned inside out, looking sad and dejected in a stylized, humorous way. A flashy 'GAME OVER' text is prominently visible and integrated into the scene. Art style: vibrant, exaggerated caricature.";
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9',
      },
    });
    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    return "https://picsum.photos/1920/1080?blur=10"; // Fallback
  } catch (error) {
    console.error("Error generating game over image:", error);
    return "https://picsum.photos/1920/1080?blur=10";
  }
};

export const generateVictoryImage = async (): Promise<string> => {
    const prompt = "A celebratory, high-quality anime splash art. The entire scene is perfectly framed to be fully visible. The victorious poker player is sitting triumphantly on a plush couch, centered, surrounded by the three happy anime bunny girl dealers (one with silver hair, one with pink hair, one with blonde hair). They are all raising glasses of champagne in a toast. The mood is joyful, with confetti in the air. A stylish 'YOU WIN!' text is prominently visible and integrated into the scene. Art style: vibrant, detailed anime.";
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      });
      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
      }
      return "https://picsum.photos/1920/1080"; // Fallback
    } catch (error) {
      console.error("Error generating victory image:", error);
      return "https://picsum.photos/1920/1080";
    }
};
