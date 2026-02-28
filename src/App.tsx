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
  CardType as HandType,
  Difficulty
} from './types';
import { createDeck, shuffle, sortCards } from './constants';
import { getCardType, canPlay } from './gameLogic';
import { Trophy, User, Cat, RotateCcw, Play, SkipForward, Heart, Star, PawPrint, Volume2, VolumeX, Smartphone, Brain, Maximize2, Minimize2 } from 'lucide-react';

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
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);

  // Window size hook to handle orientation changes
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      // Fix for mobile browser chrome issues on orientation change
      window.scrollTo(0, 0);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Fallback interval for iframe environments
    const interval = setInterval(handleResize, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearInterval(interval);
    };
  }, []);

  const isLandscape = windowSize.width > windowSize.height;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Audio refs using Howler
  const bgmRef = useRef<Howl | null>(null);
  const sfxRefs = useRef<Record<string, Howl | null>>({});

  useEffect(() => {
    // Enable Howler auto-unlock for mobile
    Howler.autoUnlock = true;

    // Initialize Howls with more reliable URLs
    bgmRef.current = new Howl({
      src: ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'],
      loop: true,
      volume: 0.3,
      html5: true,
      preload: true
    });

    sfxRefs.current = {
      play: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/pop.ogg'], preload: true, html5: false }),
      bomb: new Howl({ src: ['https://actions.google.com/sounds/v1/explosions/explosion_with_debris.ogg'], preload: true, html5: false }),
      rocket: new Howl({ src: ['https://actions.google.com/sounds/v1/science_fiction/sci_fi_rocket_launch.ogg'], preload: true, html5: false }),
      win: new Howl({ src: ['https://actions.google.com/sounds/v1/human_voices/human_applause.ogg'], preload: true, html5: false }),
      meow: new Howl({ src: ['https://actions.google.com/sounds/v1/animals/cat_meow.ogg'], preload: true, html5: false }),
      straight: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/slide_whistle.ogg'], preload: true, html5: false }),
      airplane: new Howl({ src: ['https://actions.google.com/sounds/v1/transportation/airplane_passing_by.ogg'], preload: true, html5: false }),
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
    // Explicitly resume audio context on user interaction
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

  const DIFFICULTY_MAP: Record<Difficulty, string> = {
    [Difficulty.BEGINNER]: '新手',
    [Difficulty.INTERMEDIATE]: '进阶',
    [Difficulty.EXPERT]: '高手',
    [Difficulty.MASTER]: '大师',
  };

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
        const currentPlayer = players[currentTurn];
        let bid = 0;
        
        if (difficulty === Difficulty.BEGINNER) {
          bid = Math.random() > 0.6 ? Math.min(3, highestBid + 1) : 0;
        } else {
          // Count high cards (2, Jokers)
          const highCards = currentPlayer.hand.filter(c => c.rank >= Rank.TWO).length;
          const hasRocket = currentPlayer.hand.some(c => c.rank === Rank.SMALL_JOKER) && currentPlayer.hand.some(c => c.rank === Rank.BIG_JOKER);
          
          let score = highCards * 0.5;
          if (hasRocket) score += 2;
          
          if (score >= 3) bid = 3;
          else if (score >= 2) bid = 2;
          else if (score >= 1) bid = 1;
          
          if (bid <= highestBid) bid = 0;
        }
        
        handleBid(bid);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, currentTurn, players, highestBid, difficulty]);

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
      const delay = difficulty === Difficulty.BEGINNER ? 2000 : difficulty === Difficulty.INTERMEDIATE ? 1500 : 1000;
      const timer = setTimeout(() => {
        const currentPlayer = players[currentTurn];
        
        // AI Logic based on difficulty
        const playLogic = () => {
          // If starting a new round
          if (lastPlayerId === currentTurn || lastPlayerId === null) {
            // Beginner: play smallest card
            if (difficulty === Difficulty.BEGINNER) {
              return [currentPlayer.hand[0]];
            }
            // Intermediate/Expert: play smallest single or pair
            const counts: Record<number, CardType[]> = {};
            currentPlayer.hand.forEach(c => {
              if (!counts[c.rank]) counts[c.rank] = [];
              counts[c.rank].push(c);
            });
            
            const pairs = Object.values(counts).filter(cs => cs.length === 2);
            if (pairs.length > 0 && difficulty !== Difficulty.BEGINNER) {
              return pairs[0];
            }
            return [currentPlayer.hand[0]];
          }

          // Following a play
          const counts: Record<number, CardType[]> = {};
          currentPlayer.hand.forEach(c => {
            if (!counts[c.rank]) counts[c.rank] = [];
            counts[c.rank].push(c);
          });

          // Beginner might "forget" to play 30% of the time
          if (difficulty === Difficulty.BEGINNER && Math.random() < 0.3) return null;

          if (lastPlay?.type === HandType.SINGLE) {
            const better = currentPlayer.hand.filter(c => c.rank > lastPlay.cards[0].rank);
            if (better.length > 0) {
              // Master plays smallest possible to beat
              if (difficulty === Difficulty.MASTER || difficulty === Difficulty.EXPERT) return [better[0]];
              // Others might play a random better card
              return [better[Math.floor(Math.random() * better.length)]];
            }
          } else if (lastPlay?.type === HandType.PAIR) {
            const better = Object.values(counts).filter(cs => cs.length >= 2 && cs[0].rank > lastPlay.cards[0].rank);
            if (better.length > 0) {
              return better[0].slice(0, 2);
            }
          }

          // Check for bombs (Master/Expert more likely to use them)
          const bombChance = difficulty === Difficulty.MASTER ? 0.8 : difficulty === Difficulty.EXPERT ? 0.5 : 0.2;
          if (Math.random() < bombChance) {
            const bomb = Object.values(counts).find(cs => cs.length === 4);
            if (bomb) return bomb;
            
            // Rocket
            const hasSmallJoker = currentPlayer.hand.some(c => c.rank === Rank.SMALL_JOKER);
            const hasBigJoker = currentPlayer.hand.some(c => c.rank === Rank.BIG_JOKER);
            if (hasSmallJoker && hasBigJoker) {
              return currentPlayer.hand.filter(c => c.rank === Rank.SMALL_JOKER || c.rank === Rank.BIG_JOKER);
            }
          }

          return null;
        };

        const cardsToPlay = playLogic();
        if (cardsToPlay && cardsToPlay.length > 0) {
          handlePlay(cardsToPlay);
        } else {
          handlePass();
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [phase, currentTurn, lastPlay, lastPlayerId, players, difficulty]);

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
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-[100dvh] bg-[#FFF9F2] text-slate-800 font-sans selection:bg-rose-200 overflow-hidden flex flex-col">
      {/* Orientation Hint for Mobile Portrait */}
      {!isLandscape && typeof window !== 'undefined' && window.innerWidth < 1024 && (
        <div className="absolute inset-0 z-[200] bg-rose-500 flex flex-col items-center justify-center p-6 text-center text-white">
          <motion.div
            animate={{ rotate: 90 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="mb-6"
          >
            <Smartphone className="w-20 h-20" />
          </motion.div>
          <h2 className="text-2xl font-black mb-2">请旋转手机</h2>
          <p className="font-bold opacity-90">横屏模式下游戏体验更佳喵！</p>
          <button 
            onClick={() => setIsFullscreen(false)} // Just a dummy to trigger re-render or interaction
            className="mt-8 px-6 py-2 bg-white text-rose-500 rounded-full font-black text-sm"
          >
            我知道了
          </button>
        </div>
      )}

      {/* Start Overlay */}
      {phase === GamePhase.WAITING && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-rose-50/95 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 sm:p-12 landscape:p-4 rounded-[2.5rem] sm:rounded-[4rem] landscape:rounded-3xl shadow-2xl shadow-rose-200 flex flex-col items-center gap-4 sm:gap-8 landscape:gap-2 border-8 landscape:border-4 border-white max-w-[90vw] text-center"
          >
            <div className="w-20 h-20 sm:w-32 sm:h-32 landscape:w-12 landscape:h-12 bg-rose-400 rounded-[2rem] sm:rounded-[3rem] landscape:rounded-xl flex items-center justify-center shadow-2xl shadow-rose-200 animate-bounce">
              <Cat className="w-12 h-12 sm:w-20 sm:h-20 landscape:w-8 landscape:h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-5xl landscape:text-2xl font-black text-rose-600 mb-2 landscape:mb-1">Kitty 斗地主</h2>
              <p className="text-rose-400 font-bold text-base sm:text-xl landscape:text-xs">点击开始，开启猫咪对战之旅！喵~</p>
            </div>

            {/* Difficulty Selection */}
            <div className="flex flex-col gap-3 landscape:gap-1 w-full max-w-xs">
              <div className="flex items-center justify-center gap-2 text-rose-400 font-black text-lg landscape:text-sm">
                <Brain className="w-5 h-5 landscape:w-3 landscape:h-3" />
                <span>选择难度</span>
              </div>
              <div className="grid grid-cols-2 gap-2 landscape:gap-1">
                {Object.entries(DIFFICULTY_MAP).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key as Difficulty)}
                    className={`px-4 py-2 landscape:px-2 landscape:py-1 rounded-2xl landscape:rounded-lg font-black text-sm landscape:text-[10px] transition-all border-2 ${difficulty === key ? 'bg-rose-500 text-white border-rose-500 shadow-lg scale-105' : 'bg-white text-rose-400 border-rose-100 hover:border-rose-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={startNewGame}
              className="group relative px-12 py-4 sm:px-16 sm:py-6 landscape:px-8 landscape:py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-3xl landscape:rounded-xl font-black text-xl sm:text-3xl landscape:text-lg shadow-2xl shadow-rose-200 transition-all hover:scale-110 active:scale-95 flex items-center gap-4 landscape:gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Play className="w-8 h-8 sm:w-10 sm:h-10 landscape:w-5 landscape:h-5 fill-current" />
              开始游戏
            </button>
            <div className="flex flex-col items-center gap-2 landscape:gap-0.5 text-rose-300">
              <div className="flex items-center gap-2 text-xs sm:text-sm landscape:text-[10px] font-bold">
                <Smartphone className="w-4 h-4 landscape:w-3 landscape:h-3" />
                <span>推荐横屏体验，效果更佳喵！</span>
              </div>
              <p className="text-[10px] landscape:text-[8px] opacity-50">点击按钮将同时开启背景音乐与音效</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Decorative Background Elements */}
      <div className="absolute top-20 left-10 opacity-5 pointer-events-none hidden lg:block">
        <PawPrint className="w-64 h-64 rotate-12" />
      </div>
      <div className="absolute bottom-40 right-10 opacity-5 pointer-events-none hidden lg:block">
        <Heart className="w-80 h-80 -rotate-12" />
      </div>

      {/* Header */}
      <header className="p-2 sm:p-4 landscape:p-1 flex justify-between items-center bg-white/80 backdrop-blur-md border-b border-rose-100 z-50">
        <div className="flex items-center gap-2 sm:gap-3 landscape:gap-1">
          <div className="w-8 h-8 sm:w-12 sm:h-12 landscape:w-6 landscape:h-6 bg-rose-400 rounded-xl sm:rounded-2xl landscape:rounded-lg flex items-center justify-center shadow-lg shadow-rose-200">
            <Cat className="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-xl landscape:text-xs font-black tracking-tight text-rose-600 leading-tight">Kitty 斗地主</h1>
            <div className="flex items-center gap-1 text-rose-400">
              <Brain className="w-3 h-3 landscape:w-2 landscape:h-2" />
              <span className="text-[10px] landscape:text-[8px] font-bold uppercase tracking-widest">{DIFFICULTY_MAP[difficulty]}模式</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 landscape:gap-1">
          <button 
            onClick={toggleFullscreen}
            className="p-2 sm:p-3 landscape:p-1 hover:bg-rose-50 rounded-2xl transition-colors text-rose-400 border border-transparent hover:border-rose-100"
            title="全屏模式"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6 landscape:w-4 landscape:h-4" /> : <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6 landscape:w-4 landscape:h-4" />}
          </button>

          <button 
            onClick={toggleMute}
            className="p-2 sm:p-3 landscape:p-1 hover:bg-rose-50 rounded-2xl transition-colors text-rose-400 border border-transparent hover:border-rose-100"
          >
            {isMuted ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 landscape:w-4 landscape:h-4" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 landscape:w-4 landscape:h-4" />}
          </button>
          
          <button 
            onClick={() => setPhase(GamePhase.WAITING)}
            className="p-2 sm:p-3 landscape:p-1 hover:bg-rose-50 rounded-2xl transition-colors text-rose-400 border border-transparent hover:border-rose-100"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 landscape:w-4 landscape:h-4" />
          </button>
        </div>
      </header>

      {/* Game Board */}
      <main className={`flex-1 relative flex flex-col items-center justify-center p-2 sm:p-8 ${isLandscape ? 'p-1' : ''} overflow-hidden`}>
        {/* AI Players - Mimi (Right) */}
        <div className={`absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 ${isLandscape ? 'right-2 gap-1' : ''}`}>
          <div className={`w-12 h-12 sm:w-20 sm:h-20 ${isLandscape ? 'w-10 h-10 rounded-xl border-2' : 'rounded-[1.5rem] sm:rounded-[2.5rem] border-4'} flex items-center justify-center transition-all duration-500 ${currentTurn === 1 ? 'bg-rose-400 border-white shadow-2xl scale-110' : 'bg-white border-rose-100 shadow-md'}`}>
            <Cat className={`w-6 h-6 sm:w-10 sm:h-10 ${isLandscape ? 'w-5 h-5' : ''} ${currentTurn === 1 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className={`bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-100 shadow-sm flex flex-col items-center min-w-[80px] ${isLandscape ? 'min-w-[60px]' : ''}`}>
            <p className={`font-black text-[10px] sm:text-sm ${isLandscape ? 'text-[8px]' : ''} text-rose-700`}>{players[1].name}</p>
            <div className="flex items-center gap-1">
              <Star className="w-2 h-2 text-amber-400 fill-current" />
              <p className={`text-[8px] sm:text-[10px] ${isLandscape ? 'text-[7px]' : ''} font-bold text-rose-400`}>{players[1].hand.length} 张</p>
            </div>
            {players[1].role !== PlayerRole.UNDECIDED && (
              <span className={`text-[8px] ${isLandscape ? 'text-[6px]' : ''} px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter mt-0.5`}>
                {ROLE_MAP[players[1].role]}
              </span>
            )}
          </div>
        </div>

        {/* AI Players - Coco (Left) */}
        <div className={`absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 ${isLandscape ? 'left-2 gap-1' : ''}`}>
          <div className={`w-12 h-12 sm:w-20 sm:h-20 ${isLandscape ? 'w-10 h-10 rounded-xl border-2' : 'rounded-[1.5rem] sm:rounded-[2.5rem] border-4'} flex items-center justify-center transition-all duration-500 ${currentTurn === 2 ? 'bg-rose-400 border-white shadow-2xl scale-110' : 'bg-white border-rose-100 shadow-md'}`}>
            <Cat className={`w-6 h-6 sm:w-10 sm:h-10 ${isLandscape ? 'w-5 h-5' : ''} ${currentTurn === 2 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className={`bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-100 shadow-sm flex flex-col items-center min-w-[80px] ${isLandscape ? 'min-w-[60px]' : ''}`}>
            <p className={`font-black text-[10px] sm:text-sm ${isLandscape ? 'text-[8px]' : ''} text-rose-700`}>{players[2].name}</p>
            <div className="flex items-center gap-1">
              <Star className="w-2 h-2 text-amber-400 fill-current" />
              <p className={`text-[8px] sm:text-[10px] ${isLandscape ? 'text-[7px]' : ''} font-bold text-rose-400`}>{players[2].hand.length} 张</p>
            </div>
            {players[2].role !== PlayerRole.UNDECIDED && (
              <span className={`text-[8px] ${isLandscape ? 'text-[6px]' : ''} px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter mt-0.5`}>
                {ROLE_MAP[players[2].role]}
              </span>
            )}
          </div>
        </div>

        {/* Center Area: Last Play & Messages */}
        <div className="flex flex-col items-center gap-4 sm:gap-10 landscape:gap-2 w-full max-w-2xl px-4">
          <div className="min-h-[7rem] sm:min-h-[12rem] landscape:min-h-[4rem] h-auto flex items-center justify-center py-2">
            <AnimatePresence mode="wait">
              {lastPlay && lastPlayerId !== null && (
                <motion.div 
                  key={`${lastPlayerId}-${lastPlay.cards.map(c => c.id).join('-')}`}
                  initial={{ scale: 0.5, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="flex flex-wrap justify-center gap-1 sm:gap-3 landscape:gap-0.5 max-w-full overflow-visible"
                >
                  {lastPlay.cards.map(card => (
                    <div key={card.id} className={`w-10 h-16 sm:w-24 sm:h-36 landscape:w-8 landscape:h-12 bg-white rounded-lg sm:rounded-2xl landscape:rounded-md shadow-2xl border border-rose-50 flex flex-col p-1 sm:p-3 landscape:p-0.5 flex-shrink-0 ${getCardColor(card.suit)}`}>
                      <span className="text-xs sm:text-3xl landscape:text-[10px] font-black leading-none">{card.label}</span>
                      <div className="flex-1 flex items-center justify-center overflow-hidden rounded-md my-1 bg-rose-50/20 relative min-h-[40%]">
                        {card.rank === Rank.SMALL_JOKER || card.rank === Rank.BIG_JOKER ? (
                          <img 
                            src={card.rank === Rank.BIG_JOKER 
                              ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80" 
                              : "https://images.unsplash.com/photo-1573865662567-57ef7b341231?auto=format&fit=crop&w=300&q=80"} 
                            alt="Kitty Joker"
                            className="absolute inset-0 w-full h-full object-contain p-0.5"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl sm:text-8xl landscape:text-xl font-black opacity-10">{card.label}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-end rotate-180">
                        <span className="text-xs sm:text-3xl landscape:text-[10px] font-black leading-none">{card.label}</span>
                        <span className="text-[8px] sm:text-xl landscape:text-[6px]">{card.suit}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white/80 backdrop-blur-md px-6 py-3 sm:px-12 sm:py-6 landscape:px-4 landscape:py-1 rounded-[2rem] sm:rounded-[3rem] landscape:rounded-xl border-4 landscape:border-2 border-white shadow-2xl shadow-rose-100/50 text-center max-w-md">
            <p className="text-sm sm:text-2xl landscape:text-xs font-black text-rose-600 tracking-tight leading-tight">{gameMessage}</p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-6 landscape:gap-2 h-14 sm:h-20 landscape:h-8">
            {phase === GamePhase.BIDDING && currentTurn === 0 && (
              <div className="flex gap-2 sm:gap-4 landscape:gap-1">
                {[1, 2, 3].map(bid => (
                  <button
                    key={bid}
                    disabled={bid <= highestBid}
                    onClick={() => handleBid(bid)}
                    className={`px-4 sm:px-10 py-2 sm:py-4 landscape:px-3 landscape:py-1 rounded-xl sm:rounded-3xl landscape:rounded-lg font-black text-sm sm:text-xl landscape:text-[10px] transition-all shadow-xl ${bid <= highestBid ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-400 hover:bg-rose-500 text-white shadow-rose-200 hover:scale-110 active:scale-95'}`}
                  >
                    {bid}分
                  </button>
                ))}
                <button
                  onClick={() => handleBid(0)}
                  className="px-4 sm:px-10 py-2 sm:py-4 landscape:px-3 landscape:py-1 bg-white hover:bg-rose-50 text-rose-400 rounded-xl sm:rounded-3xl landscape:rounded-lg font-black text-sm sm:text-xl landscape:text-[10px] border-2 border-rose-100 transition-all shadow-xl hover:scale-110 active:scale-95"
                >
                  不叫
                </button>
              </div>
            )}

            {phase === GamePhase.PLAYING && currentTurn === 0 && (
              <div className="flex gap-2 sm:gap-6 landscape:gap-2">
                <button
                  onClick={() => handlePlay(players[0].hand.filter(c => selectedCards.includes(c.id)))}
                  className="px-8 sm:px-14 py-2 sm:py-4 landscape:px-4 landscape:py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl sm:rounded-3xl landscape:rounded-lg font-black text-sm sm:text-xl landscape:text-[10px] shadow-2xl shadow-rose-200 transition-all hover:scale-110 active:scale-95 flex items-center gap-3 landscape:gap-1"
                >
                  <Play className="w-4 h-4 sm:w-6 sm:h-6 landscape:w-3 landscape:h-3 fill-current" />
                  出牌
                </button>
                <button
                  disabled={lastPlayerId === 0 || lastPlayerId === null}
                  onClick={handlePass}
                  className={`px-8 sm:px-14 py-2 sm:py-4 landscape:px-4 landscape:py-1 rounded-xl sm:rounded-3xl landscape:rounded-lg font-black text-sm sm:text-xl landscape:text-[10px] transition-all shadow-xl flex items-center gap-3 landscape:gap-1 ${lastPlayerId === 0 || lastPlayerId === null ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white hover:bg-rose-50 text-rose-400 border-2 border-rose-100 shadow-rose-100 hover:scale-110 active:scale-95'}`}
                >
                  <SkipForward className="w-4 h-4 sm:w-6 sm:h-6 landscape:w-3 landscape:h-3" />
                  不出
                </button>
              </div>
            )}

            {phase === GamePhase.GAME_OVER && (
              <button
                onClick={() => setPhase(GamePhase.WAITING)}
                className="px-10 sm:px-16 py-3 sm:py-5 landscape:px-6 landscape:py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl sm:rounded-3xl landscape:rounded-lg font-black text-sm sm:text-2xl landscape:text-xs shadow-2xl shadow-rose-200 transition-all hover:scale-110 active:scale-95 flex items-center gap-4 landscape:gap-2"
              >
                <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8 landscape:w-4 landscape:h-4" />
                再来一局
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Player Hand */}
      <footer className="h-40 sm:h-64 landscape:h-32 bg-white/95 backdrop-blur-3xl border-t-4 border-rose-100 p-2 sm:p-6 landscape:p-1 relative flex justify-center z-40">
        <div className="absolute -top-10 left-4 sm:left-10 landscape:-top-6 landscape:left-2 flex items-center gap-3 landscape:gap-1">
          <div className={`w-10 h-10 sm:w-16 sm:h-16 landscape:w-8 landscape:h-8 rounded-2xl landscape:rounded-lg flex items-center justify-center border-4 landscape:border-2 transition-all duration-500 ${currentTurn === 0 ? 'bg-rose-400 border-white shadow-2xl scale-110' : 'bg-white border-rose-100 shadow-md'}`}>
            <User className={`w-5 h-5 sm:w-10 sm:h-10 landscape:w-4 landscape:h-4 ${currentTurn === 0 ? 'text-white' : 'text-rose-300'}`} />
          </div>
          <div className="bg-white/90 backdrop-blur-sm px-4 py-1 rounded-full border border-rose-100 shadow-sm">
            <p className="font-black text-[10px] sm:text-xs landscape:text-[8px] text-rose-700">你的手牌</p>
            {players[0].role !== PlayerRole.UNDECIDED && (
              <span className="text-[8px] landscape:text-[6px] px-2 py-0.5 bg-rose-500 text-white rounded-full uppercase font-black tracking-tighter block text-center mt-0.5">
                {ROLE_MAP[players[0].role]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center w-full max-w-6xl relative h-full">
          {players[0].hand.map((card, index) => {
            const isSelected = selectedCards.includes(card.id);
            const totalCards = players[0].hand.length;
            
            // Responsive overlap - Increased spacing even more
            const baseOverlap = isLandscape ? 40 : (windowSize.width < 640 ? 25 : 60);
            const overlap = Math.min(baseOverlap, (windowSize.width * 0.92) / totalCards);
            const offset = (index - (totalCards - 1) / 2) * overlap;
            
            return (
              <motion.div
                key={card.id}
                layoutId={card.id}
                onClick={() => toggleCardSelection(card.id)}
                className={`absolute w-12 h-20 sm:w-32 sm:h-48 landscape:w-10 landscape:h-16 bg-white rounded-xl sm:rounded-[2rem] landscape:rounded-lg shadow-2xl cursor-pointer flex flex-col p-1.5 sm:p-5 landscape:p-1 transition-all duration-300 border-2 border-rose-50/50 ${getCardColor(card.suit)} ${isSelected ? 'ring-4 ring-rose-400 ring-offset-2' : ''}`}
                style={{ 
                  left: `calc(50% + ${offset}px)`,
                  zIndex: index,
                  transform: `translateX(-50%) ${isSelected ? (isLandscape ? 'translateY(-20px)' : 'translateY(-40px)') : ''}`,
                }}
                whileHover={{ 
                  scale: 1.1, 
                  zIndex: 100, 
                  y: isSelected ? (isLandscape ? -30 : -50) : (isLandscape ? -10 : -15) 
                }}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm sm:text-4xl landscape:text-xs font-black leading-none">{card.label}</span>
                  <span className="text-[10px] sm:text-2xl landscape:text-[8px]">{card.suit}</span>
                </div>
                <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl my-1 bg-rose-50/10 relative min-h-[40%]">
                   {card.rank === Rank.SMALL_JOKER || card.rank === Rank.BIG_JOKER ? (
                     <img 
                       src={card.rank === Rank.BIG_JOKER 
                         ? "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80" 
                         : "https://images.unsplash.com/photo-1573865662567-57ef7b341231?auto=format&fit=crop&w=300&q=80"} 
                       alt="Kitty Joker"
                       className="absolute inset-0 w-full h-full object-contain p-1"
                       referrerPolicy="no-referrer"
                     />
                   ) : (
                     <span className="text-3xl sm:text-9xl landscape:text-xl font-black opacity-10">{card.label}</span>
                   )}
                </div>
                <div className="flex justify-between items-end rotate-180">
                  <span className="text-sm sm:text-4xl landscape:text-xs font-black leading-none">{card.label}</span>
                  <span className="text-[10px] sm:text-2xl landscape:text-[8px]">{card.suit}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
