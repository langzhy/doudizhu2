/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Howl, Howler } from 'howler';
import { 
  Card as CardType, 
  GamePhase, 
  Player, 
  PlayerRole, 
  Suit, 
  Rank,
  PlayResult, 
  CardType as HandType 
} from './types';
import { createDeck, shuffle, sortCards } from './constants';
import { getCardType, canPlay } from './gameLogic';
import { Trophy, User, Cat, RotateCcw, Play, SkipForward, Heart, Star, PawPrint, Volume2, VolumeX, Smartphone } from 'lucide-react';

const INITIAL_PLAYERS: Player[] = [
  { id: 0, name: '你 (Kitty)', hand: [], role: PlayerRole.UNDECIDED, isAI: false, score: 0 },
  { id: 1, name: 'Mimi', hand: [], role: PlayerRole.UNDECIDED, isAI: true, score: 0 },
  { id: 2, name: 'Coco', hand: [], role: PlayerRole.UNDECIDED, isAI: true, score: 0 },
];

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(GamePhase.WAITING);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [bottomCards, setBottomCards] = useState<CardType[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [lastPlay, setLastPlay] = useState<PlayResult | null>(null);
  const [lastPlayerId, setLastPlayerId] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [highestBid, setHighestBid] = useState(0);
  const [bidderId, setBidderId] = useState<number | null>(null);
  const [bidsCount, setBidsCount] = useState(0);
  const [gameMessage, setGameMessage] = useState('欢迎来到 Kitty 斗地主！喵~');
  const [winner, setWinner] = useState<PlayerRole | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Audio refs using Howler
  const bgmRef = useRef<Howl | null>(null);
  const sfxRefs = useRef<Record<string, Howl | null>>({});

  useEffect(() => {
    // Initialize Howls
    bgmRef.current = new Howl({
      src: ['https://assets.mixkit.co/music/preview/mixkit-funny-cat-1109.mp3'],
      loop: true,
      volume: 0.2,
      html5: true,
      preload: true
    });

    sfxRefs.current = {
      play: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-card-shuffle-607.mp3'], preload: true }),
      bomb: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-explosion-with-debris-2188.mp3'], preload: true }),
      rocket: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-rocket-launch-off-2144.mp3'], preload: true }),
      win: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'], preload: true }),
      meow: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-cat-meow-1453.mp3'], preload: true }),
      straight: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-magic-sweep-glissando-2615.mp3'], preload: true }),
      airplane: new Howl({ src: ['https://assets.mixkit.co/sfx/preview/mixkit-fast-jet-passing-by-1554.mp3'], preload: true }),
    };

    return () => {
      Howler.unload();
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) {
      if (!isMuted && phase !== GamePhase.WAITING) {
        if (!bgmRef.current.playing()) bgmRef.current.play();
      } else {
        bgmRef.current.pause();
      }
    }
  }, [isMuted, phase]);

  const playSFX = useCallback((type: string) => {
    if (isMuted) return;
    const sound = sfxRefs.current[type];
    if (sound) {
      sound.stop();
      sound.play();
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    Howler.mute(newMuted);
  }, [isMuted]);

  // Translation maps
  const ROLE_MAP: Record<PlayerRole, string> = {
    [PlayerRole.LANDLORD]: '地主',
    [PlayerRole.PEASANT]: '农民',
    [PlayerRole.UNDECIDED]: '未定',
  };

  const CARD_TYPE_MAP: Record<HandType, string> = {
    [HandType.INVALID]: '无效',
    [HandType.SINGLE]: '单张',
    [HandType.PAIR]: '对子',
    [HandType.TRIPLE]: '三张',
    [HandType.TRIPLE_ONE]: '三带一',
    [HandType.TRIPLE_PAIR]: '三带二',
    [HandType.STRAIGHT]: '顺子',
    [HandType.DOUBLE_STRAIGHT]: '连对',
    [HandType.AIRPLANE]: '飞机',
    [HandType.AIRPLANE_WINGS]: '飞机带翅膀',
    [HandType.QUAD_TWO]: '四带二',
    [HandType.BOMB]: '炸弹',
    [HandType.ROCKET]: '火箭',
  };

  // Initialize Game
  const startNewGame = useCallback(() => {
    // Resume audio context on user interaction
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume();
    }
    
    if (bgmRef.current && !isMuted) {
      bgmRef.current.play();
    }
    playSFX('meow');
    
    const deck = shuffle(createDeck());
    const p1Hand = sortCards(deck.slice(0, 17));
    const p2Hand = sortCards(deck.slice(17, 34));
    const p3Hand = sortCards(deck.slice(34, 51));
    const bottom = deck.slice(51, 54);

    setPlayers(prev => [
      { ...prev[0], hand: p1Hand, role: PlayerRole.UNDECIDED },
      { ...prev[1], hand: p2Hand, role: PlayerRole.UNDECIDED },
      { ...prev[2], hand: p3Hand, role: PlayerRole.UNDECIDED },
    ]);
    setBottomCards(bottom);
    setPhase(GamePhase.BIDDING);
    setCurrentTurn(Math.floor(Math.random() * 3));
    setHighestBid(0);
    setBidderId(null);
    setBidsCount(0);
    setLastPlay(null);
    setLastPlayerId(null);
    setSelectedCards([]);
    setWinner(null);
    setGameMessage('请叫分，喵~');
  }, [isMuted, playSFX]);

  // Handle Bidding
  const handleBid = (bid: number) => {
    let newHighestBid = highestBid;
    let newBidderId = bidderId;
    
    if (bid > highestBid) {
      newHighestBid = bid;
      newBidderId = currentTurn;
    }

    const nextBidsCount = bidsCount + 1;
    const nextTurn = (currentTurn + 1) % 3;

    if (nextBidsCount === 3 || newHighestBid === 3) {
      if (newHighestBid === 0) {
        setGameMessage('没人叫分，重新发牌，喵~');
        setTimeout(startNewGame, 1500);
        return;
      }
      
      const finalBidderId = newBidderId!;
      setPlayers(prev => prev.map(p => ({
        ...p,
        role: p.id === finalBidderId ? PlayerRole.LANDLORD : PlayerRole.PEASANT,
        hand: p.id === finalBidderId ? sortCards([...p.hand, ...bottomCards]) : p.hand
      })));
      setPhase(GamePhase.PLAYING);
      setCurrentTurn(finalBidderId);
      setGameMessage(`${players[finalBidderId].name} 成为了地主！小心哦！`);
    } else {
      setHighestBid(newHighestBid);
      setBidderId(newBidderId);
      setBidsCount(nextBidsCount);
      setCurrentTurn(nextTurn);
      setGameMessage(`${players[currentTurn].name} 叫了 ${bid || '不叫'}。`);
    }
  };

  // AI Bidding
  useEffect(() => {
    if (phase === GamePhase.BIDDING && players[currentTurn].isAI) {
      const timer = setTimeout(() => {
        const bid = Math.random() > 0.5 ? Math.min(3, highestBid + 1) : 0;
        handleBid(bid);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, currentTurn, players, highestBid]);

  // Handle Playing Cards
  const handlePlay = (cardsToPlay: CardType[]) => {
    const result = getCardType(cardsToPlay);
    if (!canPlay(result, lastPlayerId === currentTurn ? null : lastPlay)) {
      setGameMessage('哎呀！这样出牌不行哦，喵！');
      return;
    }

    // Play sound effects
    if (result.type === HandType.BOMB) playSFX('bomb');
    else if (result.type === HandType.ROCKET) playSFX('rocket');
    else if (result.type === HandType.STRAIGHT || result.type === HandType.DOUBLE_STRAIGHT) playSFX('straight');
    else if (result.type === HandType.AIRPLANE || result.type === HandType.AIRPLANE_WINGS) playSFX('airplane');
    else playSFX('play');

    const newPlayers = [...players];
    const currentPlayer = newPlayers[currentTurn];
    currentPlayer.hand = currentPlayer.hand.filter(c => !cardsToPlay.find(cp => cp.id === c.id));

    setPlayers(newPlayers);
    setLastPlay(result);
    setLastPlayerId(currentTurn);
    setSelectedCards([]);
    setGameMessage(`${currentPlayer.name} 打出了 ${CARD_TYPE_MAP[result.type]}！`);

    if (currentPlayer.hand.length === 0) {
      setPhase(GamePhase.GAME_OVER);
      setWinner(currentPlayer.role);
      playSFX('win');
      setGameMessage(`${currentPlayer.name} 赢了！太棒了！`);
    } else {
      setCurrentTurn((currentTurn + 1) % 3);
    }
  };

  const handlePass = () => {
    playSFX('play');
    setLastPlay(lastPlay);
    setCurrentTurn((currentTurn + 1) % 3);
    setGameMessage(`${players[currentTurn].name} 不出。`);
  };

  // AI Playing
  useEffect(() => {
    if (phase === GamePhase.PLAYING && players[currentTurn].isAI) {
      const timer = setTimeout(() => {
        const currentPlayer = players[currentTurn];
        // Simple AI: play a single card or pass
        if (lastPlayerId === currentTurn || lastPlayerId === null) {
          handlePlay([currentPlayer.hand[currentPlayer.hand.length - 1]]);
        } else {
          // Try to find a card to beat last play
          let found = false;
          // Very basic AI logic
          const counts: Record<number, CardType[]> = {};
          currentPlayer.hand.forEach(c => {
             if (!counts[c.rank]) counts[c.rank] = [];
             counts[c.rank].push(c);
          });

          if (lastPlay?.type === HandType.SINGLE) {
             const better = currentPlayer.hand.find(c => c.rank > lastPlay.cards[0].rank);
             if (better) {
               handlePlay([better]);
               found = true;
             }
          } else if (lastPlay?.type === HandType.PAIR) {
             const better = Object.values(counts).find(cs => cs.length >= 2 && cs[0].rank > lastPlay.cards[0].rank);
             if (better) {
               handlePlay(better.slice(0, 2));
               found = true;
             }
          }

          // Check for bombs if not found
          if (!found) {
             const bomb = Object.values(counts).find(cs => cs.length === 4);
             if (bomb) {
               handlePlay(bomb);
               found = true;
             }
          }

          if (!found) {
            handlePass();
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, currentTurn, lastPlay, lastPlayerId, players]);

  const toggleCardSelection = (cardId: string) => {
    if (phase !== GamePhase.PLAYING || currentTurn !== 0) return;
    playSFX('play');
    setSelectedCards(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const getCardColor = (suit: Suit) => {
    return (suit === Suit.HEART || suit === Suit.DIAMOND) ? 'text-rose-500' : 'text-slate-800';
  };

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-slate-800 font-sans selection:bg-rose-200 overflow-hidden flex flex-col relative landscape:flex-row">
      {/* Start Overlay */}
      {phase === GamePhase.WAITING && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-rose-50/90 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-rose-200 flex flex-col items-center gap-4 sm:gap-6 border-4 border-white max-w-[90vw]"
          >
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-rose-400 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-rose-200">
              <Cat className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-black text-rose-600">Kitty 斗地主</h2>
              <p className="text-rose-400 font-bold text-sm sm:text-base">准备好和猫咪们对战了吗？喵~</p>
            </div>
            <button 
              onClick={startNewGame}
              className="px-8 py-3 sm:px-10 sm:py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-lg sm:text-xl shadow-lg shadow-rose-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              开始游戏
            </button>
            <div className="flex items-center gap-2 text-rose-300 text-[10px] sm:text-xs">
              <Smartphone className="w-3 h-3" />
              <span>支持手机横屏体验更佳</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Decorative Background Elements */}
      <div className="absolute top-20 left-10 opacity-10 pointer-events-none hidden sm:block">
        <PawPrint className="w-32 h-32 rotate-12" />
      </div>
      <div className="absolute bottom-40 right-10 opacity-10 pointer-events-none hidden sm:block">
        <Heart className="w-40 h-40 -rotate-12" />
      </div>

      {/* Header */}
      <header className="p-2 sm:p-4 flex justify-between items-center bg-white/80 backdrop-blur-md border-b border-rose-100 z-50 landscape:fixed landscape:top-0 landscape:left-0 landscape:right-0 landscape:h-12 landscape:p-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
            <Cat className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-rose-600">Kitty 斗地主</h1>
            <p className="text-[8px] sm:text-[10px] text-rose-400 font-bold uppercase tracking-widest">Kitty 斗地主</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-rose-50 rounded-2xl border border-rose-100">
            <Star className="w-4 h-4 text-rose-400 fill-rose-400" />
            <span className="text-sm font-black text-rose-600">底牌</span>
            <div className="flex gap-1 ml-2">
              {bottomCards.length > 0 ? bottomCards.map((card, i) => (
                <div key={i} className={`w-6 h-9 sm:w-8 sm:h-12 bg-white rounded-md shadow-sm border border-rose-100 flex items-center justify-center text-[10px] sm:text-xs font-bold ${getCardColor(card.suit)}`}>
                  {phase === GamePhase.PLAYING ? card.label : '?'}
                </div>
              )) : [1,2,3].map(i => (
                <div key={i} className="w-6 h-9 sm:w-8 sm:h-12 bg-rose-100 rounded-md border border-dashed border-rose-200" />
              ))}
            </div>
          </div>

          <button 
            onClick={toggleMute}
            className="p-2 sm:p-3 hover:bg-rose-50 rounded-2xl transition-colors text-rose-400"
          >
            {isMuted ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          
          <button 
            onClick={() => setPhase(GamePhase.WAITING)}
            className="p-2 sm:p-3 hover:bg-rose-50 rounded-2xl transition-colors text-rose-400"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </header>

      {/* Game Board */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-8 landscape:pt-16">
        {/* Top Player (Mimi) */}
        <div className="absolute top-4 sm:top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 landscape:top-14">
          <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center border-4 transition-all duration-500 ${currentTurn === 1 ? 'bg-rose-400 border-white shadow-xl scale-110' : 'bg-white border-rose-100 shadow-md'}`}>
            <Cat className={`w-6 h-6 sm:w-10 sm:h-10 ${currentTurn === 1 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-50 shadow-sm flex flex-col items-center">
            <p className="font-black text-[10px] sm:text-sm text-rose-700">{players[1].name}</p>
            <p className="text-[8px] sm:text-[10px] font-bold text-rose-400">{players[1].hand.length} 张牌</p>
            {players[1].role !== PlayerRole.UNDECIDED && (
              <span className="text-[8px] px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter">
                {ROLE_MAP[players[1].role]}
              </span>
            )}
          </div>
        </div>

        {/* Left Player (Coco) */}
        <div className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 landscape:left-20">
          <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center border-4 transition-all duration-500 ${currentTurn === 2 ? 'bg-rose-400 border-white shadow-xl scale-110' : 'bg-white border-rose-100 shadow-md'}`}>
            <Cat className={`w-6 h-6 sm:w-10 sm:h-10 ${currentTurn === 2 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-50 shadow-sm flex flex-col items-center">
            <p className="font-black text-[10px] sm:text-sm text-rose-700">{players[2].name}</p>
            <p className="text-[8px] sm:text-[10px] font-bold text-rose-400">{players[2].hand.length} 张牌</p>
            {players[2].role !== PlayerRole.UNDECIDED && (
              <span className="text-[8px] px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter">
                {ROLE_MAP[players[2].role]}
              </span>
            )}
          </div>
        </div>

        {/* Center Area: Last Play & Messages */}
        <div className="flex flex-col items-center gap-4 sm:gap-10 w-full max-w-2xl px-4 landscape:gap-2">
          <div className="h-24 sm:h-40 flex items-center justify-center gap-1 sm:gap-2">
            <AnimatePresence mode="wait">
              {lastPlay && lastPlayerId !== null && (
                <motion.div 
                  key={`${lastPlayerId}-${lastPlay.cards.map(c => c.id).join('-')}`}
                  initial={{ scale: 0.8, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="flex flex-wrap justify-center gap-1 sm:gap-2"
                >
                  {lastPlay.cards.map(card => (
                    <div key={card.id} className={`w-10 h-16 sm:w-20 sm:h-32 bg-white rounded-lg sm:rounded-xl shadow-lg border border-rose-50 flex flex-col p-1 sm:p-3 ${getCardColor(card.suit)}`}>
                      <span className="text-xs sm:text-2xl font-black leading-none">{card.label}</span>
                      <div className="flex-1 flex items-center justify-center overflow-hidden rounded-md my-1">
                        {card.rank === Rank.SMALL_JOKER || card.rank === Rank.BIG_JOKER ? (
                          <div className="w-full h-full flex items-center justify-center bg-rose-50/30">
                            <img 
                              src={card.rank === Rank.BIG_JOKER 
                                ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80" 
                                : "https://images.unsplash.com/photo-1573865662567-57ef7b341231?auto=format&fit=crop&w=300&q=80"} 
                              alt="Kitty Joker"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <span className="text-2xl sm:text-8xl font-black opacity-5">{card.label}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-end rotate-180">
                        <span className="text-xs sm:text-2xl font-black leading-none">{card.label}</span>
                        <span className="text-[8px] sm:text-xl">{card.suit}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white/60 backdrop-blur-md px-4 py-2 sm:px-8 sm:py-4 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-white shadow-xl shadow-rose-100/50 text-center landscape:py-1">
            <p className="text-sm sm:text-xl font-black text-rose-600 tracking-tight">{gameMessage}</p>
          </div>

          {/* Controls */}
          <div className="flex gap-2 sm:gap-4 h-12 sm:h-16 landscape:h-10">
            {phase === GamePhase.BIDDING && currentTurn === 0 && (
              <div className="flex gap-2 sm:gap-4">
                {[1, 2, 3].map(bid => (
                  <button
                    key={bid}
                    disabled={bid <= highestBid}
                    onClick={() => handleBid(bid)}
                    className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all shadow-lg ${bid <= highestBid ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-400 hover:bg-rose-500 text-white shadow-rose-200 hover:scale-105'}`}
                  >
                    {bid}分
                  </button>
                ))}
                <button
                  onClick={() => handleBid(0)}
                  className="px-4 sm:px-8 py-2 sm:py-3 bg-white hover:bg-rose-50 text-rose-400 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg border-2 border-rose-100 transition-all shadow-lg hover:scale-105"
                >
                  不叫
                </button>
              </div>
            )}

            {phase === GamePhase.PLAYING && currentTurn === 0 && (
              <div className="flex gap-2 sm:gap-4">
                <button
                  onClick={() => handlePlay(players[0].hand.filter(c => selectedCards.includes(c.id)))}
                  className="px-6 sm:px-10 py-2 sm:py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg shadow-lg shadow-rose-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  出牌
                </button>
                <button
                  disabled={lastPlayerId === 0 || lastPlayerId === null}
                  onClick={handlePass}
                  className={`px-6 sm:px-10 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg transition-all shadow-lg flex items-center gap-2 ${lastPlayerId === 0 || lastPlayerId === null ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white hover:bg-rose-50 text-rose-400 border-2 border-rose-100 shadow-rose-100 hover:scale-105'}`}
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  不出
                </button>
              </div>
            )}

            {phase === GamePhase.GAME_OVER && (
              <button
                onClick={() => setPhase(GamePhase.WAITING)}
                className="px-8 sm:px-12 py-2 sm:py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-xl shadow-lg shadow-rose-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                再来一局
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Player Hand */}
      <footer className="h-40 sm:h-64 bg-white/90 backdrop-blur-2xl border-t border-rose-100 p-2 sm:p-6 relative flex justify-center z-40 landscape:fixed landscape:bottom-0 landscape:left-0 landscape:right-0 landscape:h-32 landscape:p-1">
        <div className="absolute -top-8 sm:-top-10 left-4 sm:left-10 flex items-center gap-2 sm:gap-3 landscape:hidden">
          <div className={`w-8 h-8 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center border-4 transition-all duration-500 ${currentTurn === 0 ? 'bg-rose-400 border-white shadow-lg' : 'bg-white border-rose-100'}`}>
            <User className={`w-4 h-4 sm:w-8 sm:h-8 ${currentTurn === 0 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-50 shadow-sm">
            <p className="font-black text-[8px] sm:text-xs text-rose-700">你的手牌</p>
            {players[0].role !== PlayerRole.UNDECIDED && (
              <span className="text-[8px] px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter">
                {ROLE_MAP[players[0].role]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center w-full max-w-6xl relative h-full">
          {players[0].hand.map((card, index) => {
            const isSelected = selectedCards.includes(card.id);
            const totalCards = players[0].hand.length;
            // Adjust overlap based on hand size and screen width
            const baseOverlap = typeof window !== 'undefined' && window.innerWidth < 640 ? 12 : 35;
            const overlap = Math.min(baseOverlap, (typeof window !== 'undefined' ? window.innerWidth * 0.8 : 800) / totalCards);
            const offset = (index - (totalCards - 1) / 2) * overlap;
            
            return (
              <motion.div
                key={card.id}
                layoutId={card.id}
                onClick={() => toggleCardSelection(card.id)}
                className={`absolute w-12 h-20 sm:w-28 sm:h-44 bg-white rounded-lg sm:rounded-2xl shadow-xl cursor-pointer flex flex-col p-1 sm:p-4 transition-all duration-300 border border-rose-50/50 ${getCardColor(card.suit)} ${isSelected ? 'ring-2 sm:ring-4 ring-rose-400 ring-offset-1 sm:ring-offset-2' : ''}`}
                style={{ 
                  left: `calc(50% + ${offset}px)`,
                  zIndex: index,
                  transform: `translateX(-50%) ${isSelected ? 'translateY(-20px)' : ''}`,
                }}
                whileHover={{ scale: 1.1, zIndex: 100, y: isSelected ? -30 : -10 }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs sm:text-3xl font-black leading-none">{card.label}</span>
                  <span className="text-[8px] sm:text-xl">{card.suit}</span>
                </div>
                <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg my-1">
                   {card.rank === Rank.SMALL_JOKER || card.rank === Rank.BIG_JOKER ? (
                     <div className="w-full h-full flex items-center justify-center bg-rose-50/30">
                       <img 
                         src={card.rank === Rank.BIG_JOKER 
                           ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80" 
                           : "https://images.unsplash.com/photo-1573865662567-57ef7b341231?auto=format&fit=crop&w=300&q=80"} 
                         alt="Kitty Joker"
                         className="w-full h-full object-contain"
                         referrerPolicy="no-referrer"
                       />
                     </div>
                   ) : (
                     <span className="text-2xl sm:text-8xl font-black opacity-5">{card.label}</span>
                   )}
                </div>
                <div className="flex justify-between items-end rotate-180">
                  <span className="text-xs sm:text-3xl font-black leading-none">{card.label}</span>
                  <span className="text-[8px] sm:text-xl">{card.suit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
