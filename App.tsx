import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Shield, 
  Flame, 
  Snowflake, 
  TrendingUp, 
  Coins, 
  Play, 
  RotateCcw, 
  Trophy,
  Target,
  CloudLightning
} from 'lucide-react';

// --- Types ---

interface Vector {
  x: number;
  y: number;
}

interface Enemy {
  id: string;
  pos: Vector;
  type: string;
  symbol: string;
  color: string;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  reward: number;
  slowed: number; // timer
  burned: number; // timer
}

interface Projectile {
  pos: Vector;
  vel: Vector;
  damage: number;
  isFire: boolean;
  targetId: string;
}

interface Particle {
  pos: Vector;
  vel: Vector;
  life: number;
  color: string;
  size: number;
}

interface Upgrade {
  id: string;
  name: string;
  level: number;
  cost: number;
  icon: React.ReactNode;
  description: string;
}

// --- Constants ---

const ALTCOINS = [
  { symbol: 'Ð', name: 'DOGE', color: '#ba9f33', hp: 1, speed: 1.5, reward: 5, type: 'meme' },
  { symbol: 'S', name: 'SHIB', color: '#ff8a00', hp: 0.8, speed: 1.8, reward: 4, type: 'meme' },
  { symbol: 'Ξ', name: 'ETH', color: '#627eea', hp: 2.5, speed: 1.0, reward: 10, type: 'top' },
  { symbol: 'S', name: 'SOL', color: '#14f195', hp: 2.0, speed: 1.2, reward: 8, type: 'top' },
  { symbol: 'B', name: 'BNB', color: '#f3ba2f', hp: 6.0, speed: 0.7, reward: 20, type: 'heavy' },
  { symbol: 'X', name: 'XRP', color: '#23292f', hp: 5.0, speed: 0.8, reward: 15, type: 'heavy' },
  { symbol: 'A', name: 'ADA', color: '#0033ad', hp: 3.0, speed: 1.1, reward: 12, type: 'top' },
  { symbol: 'M', name: 'MATIC', color: '#8247e5', hp: 2.2, speed: 1.3, reward: 9, type: 'top' },
];

const TOWER_RADIUS = 40;
const INITIAL_HP = 100;
const INITIAL_COINS = 50;

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'WIN'>('START');
  const [hp, setHp] = useState(INITIAL_HP);
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [wave, setWave] = useState(1);
  const [score, setScore] = useState(0);

  // Game State Refs
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastShotTimeRef = useRef(0);
  const waveInProgressRef = useRef(false);
  const enemiesSpawnedRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const priorityTargetIdRef = useRef<string | null>(null);

  // Upgrades State
  const [upgrades, setUpgrades] = useState<Upgrade[]>([
    { id: 'damage', name: 'Bull Run', level: 1, cost: 30, icon: <TrendingUp size={18} />, description: 'Increase damage' },
    { id: 'fireRate', name: 'High Frequency', level: 1, cost: 40, icon: <Zap size={18} />, description: 'Increase fire rate' },
    { id: 'fireDamage', name: 'Burn Mechanism', level: 0, cost: 100, icon: <Flame size={18} />, description: 'Add fire damage' },
    { id: 'multiShot', name: 'Fork', level: 1, cost: 150, icon: <CloudLightning size={18} />, description: 'Shoot multiple targets' },
    { id: 'freeze', name: 'Cold Storage', level: 0, cost: 120, icon: <Snowflake size={18} />, description: 'Slow down enemies' },
  ]);

  const getUpgradeLevel = (id: string) => upgrades.find(u => u.id === id)?.level || 0;

  // --- Game Logic ---

  const spawnEnemy = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(canvas.width, canvas.height) / 2 + 50;
    const pos = {
      x: canvas.width / 2 + Math.cos(angle) * distance,
      y: canvas.height / 2 + Math.sin(angle) * distance,
    };

    const baseType = ALTCOINS[Math.floor(Math.random() * ALTCOINS.length)];
    const waveMultiplier = 1 + (wave - 1) * 0.25;

    const newEnemy: Enemy = {
      id: Math.random().toString(36).substr(2, 9),
      pos,
      ...baseType,
      hp: baseType.hp * waveMultiplier,
      maxHp: baseType.hp * waveMultiplier,
      speed: baseType.speed * (1 + (wave - 1) * 0.05),
      radius: 18,
      slowed: 0,
      burned: 0,
    };

    enemiesRef.current.push(newEnemy);
  }, [wave]);

  const createExplosion = (pos: Vector, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        pos: { ...pos },
        vel: {
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 0.5) * 4,
        },
        life: 1.0,
        color,
        size: Math.random() * 3 + 1,
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find if clicked an enemy
    let clickedEnemyId: string | null = null;
    for (const enemy of enemiesRef.current) {
      const dist = Math.sqrt((enemy.pos.x - mouseX) ** 2 + (enemy.pos.y - mouseY) ** 2);
      if (dist < enemy.radius + 10) {
        clickedEnemyId = enemy.id;
        break;
      }
    }
    priorityTargetIdRef.current = clickedEnemyId;
  };

  const resetGame = () => {
    setHp(INITIAL_HP);
    setCoins(INITIAL_COINS);
    setWave(1);
    setScore(0);
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    enemiesSpawnedRef.current = 0;
    waveInProgressRef.current = false;
    priorityTargetIdRef.current = null;
    setUpgrades(u => u.map(item => ({ ...item, level: item.id === 'fireDamage' || item.id === 'freeze' ? 0 : 1, cost: item.id === 'damage' ? 30 : item.id === 'fireRate' ? 40 : item.id === 'fireDamage' ? 100 : item.id === 'multiShot' ? 150 : 120 })));
    setGameState('PLAYING');
  };

  const buyUpgrade = (id: string) => {
    const upgrade = upgrades.find(u => u.id === id);
    if (!upgrade || coins < upgrade.cost) return;

    setCoins(prev => prev - upgrade.cost);
    setUpgrades(prev => prev.map(u => {
      if (u.id === id) {
        return {
          ...u,
          level: u.level + 1,
          cost: Math.floor(u.cost * 1.6),
        };
      }
      return u;
    }));
  };

  // --- Main Loop ---

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const update = (time: number) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Wave Management
      const enemiesPerWave = 5 + wave * 3;
      if (!waveInProgressRef.current && enemiesRef.current.length === 0) {
        waveInProgressRef.current = true;
        enemiesSpawnedRef.current = 0;
      }

      if (waveInProgressRef.current) {
        if (time - lastSpawnTimeRef.current > Math.max(2000 - wave * 100, 500)) {
          if (enemiesSpawnedRef.current < enemiesPerWave) {
            spawnEnemy();
            enemiesSpawnedRef.current++;
            lastSpawnTimeRef.current = time;
          } else if (enemiesRef.current.length === 0) {
            waveInProgressRef.current = false;
            if (wave >= 10) {
              setGameState('WIN');
            } else {
              setWave(prev => prev + 1);
              setCoins(prev => prev + 50 + wave * 10);
            }
          }
        }
      }

      // Update Enemies
      enemiesRef.current.forEach((enemy, index) => {
        const dx = centerX - enemy.pos.x;
        const dy = centerY - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Movement
        let currentSpeed = enemy.speed;
        if (enemy.slowed > 0) {
          currentSpeed *= 0.5;
          enemy.slowed -= 16;
        }
        
        if (enemy.burned > 0) {
          enemy.hp -= 0.01 * getUpgradeLevel('fireDamage');
          enemy.burned -= 16;
        }

        enemy.pos.x += (dx / dist) * currentSpeed;
        enemy.pos.y += (dy / dist) * currentSpeed;

        // Collision with Tower
        if (dist < TOWER_RADIUS + enemy.radius) {
          setHp(prev => {
            const newHp = prev - Math.ceil(enemy.hp);
            if (newHp <= 0) setGameState('GAMEOVER');
            return Math.max(0, newHp);
          });
          createExplosion(enemy.pos, enemy.color, 15);
          enemiesRef.current.splice(index, 1);
          if (priorityTargetIdRef.current === enemy.id) priorityTargetIdRef.current = null;
        }

        // Death
        if (enemy.hp <= 0) {
          setCoins(prev => prev + enemy.reward);
          setScore(prev => prev + enemy.reward * 10);
          createExplosion(enemy.pos, enemy.color, 12);
          enemiesRef.current.splice(index, 1);
          if (priorityTargetIdRef.current === enemy.id) priorityTargetIdRef.current = null;
        }
      });

      // Shooting Logic
      const fireRateLevel = getUpgradeLevel('fireRate');
      const shootInterval = Math.max(1000 - fireRateLevel * 100, 150);
      
      if (time - lastShotTimeRef.current > shootInterval && enemiesRef.current.length > 0) {
        const multiShotLevel = getUpgradeLevel('multiShot');
        const numTargets = multiShotLevel;
        
        // Sort enemies by distance to center
        const sortedEnemies = [...enemiesRef.current].sort((a, b) => {
          if (a.id === priorityTargetIdRef.current) return -1;
          if (b.id === priorityTargetIdRef.current) return 1;
          const distA = Math.sqrt((centerX - a.pos.x) ** 2 + (centerY - a.pos.y) ** 2);
          const distB = Math.sqrt((centerX - b.pos.x) ** 2 + (centerY - b.pos.y) ** 2);
          return distA - distB;
        });

        for (let i = 0; i < Math.min(numTargets, sortedEnemies.length); i++) {
          const target = sortedEnemies[i];
          const dx = target.pos.x - centerX;
          const dy = target.pos.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          projectilesRef.current.push({
            pos: { x: centerX, y: centerY },
            vel: { x: (dx / dist) * 7, y: (dy / dist) * 7 },
            damage: 1 + getUpgradeLevel('damage') * 0.5,
            isFire: getUpgradeLevel('fireDamage') > 0,
            targetId: target.id
          });
        }
        lastShotTimeRef.current = time;
      }

      // Update Projectiles
      projectilesRef.current.forEach((p, index) => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;

        // Check collision with any enemy
        for (let i = 0; i < enemiesRef.current.length; i++) {
          const enemy = enemiesRef.current[i];
          const dist = Math.sqrt((p.pos.x - enemy.pos.x) ** 2 + (p.pos.y - enemy.pos.y) ** 2);
          
          if (dist < enemy.radius + 5) {
            enemy.hp -= p.damage;
            if (p.isFire) enemy.burned = 3000;
            if (getUpgradeLevel('freeze') > 0) enemy.slowed = 2000;
            
            projectilesRef.current.splice(index, 1);
            createExplosion(p.pos, '#f3ba2f', 4);
            break;
          }
        }

        // Out of bounds
        if (p.pos.x < 0 || p.pos.x > canvas.width || p.pos.y < 0 || p.pos.y > canvas.height) {
          projectilesRef.current.splice(index, 1);
        }
      });

      // Update Particles
      particlesRef.current.forEach((p, index) => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.life -= 0.02;
        if (p.life <= 0) particlesRef.current.splice(index, 1);
      });

      draw();
      animationFrameId = requestAnimationFrame(update);
    };

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw Grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw Tower (Bitcoin)
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f3ba2f';
      ctx.fillStyle = '#f3ba2f';
      ctx.beginPath();
      ctx.arc(centerX, centerY, TOWER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₿', centerX, centerY + 2);

      // Draw Enemies
      enemiesRef.current.forEach(enemy => {
        // HP Bar
        const barWidth = 30;
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y - enemy.radius - 10, barWidth, 4);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(enemy.pos.x - barWidth / 2, enemy.pos.y - enemy.radius - 10, barWidth * (enemy.hp / enemy.maxHp), 4);

        // Body
        ctx.fillStyle = enemy.color;
        if (priorityTargetIdRef.current === enemy.id) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        // Symbol
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(enemy.symbol, enemy.pos.x, enemy.pos.y + 1);

        // Status Effects
        if (enemy.slowed > 0) {
          ctx.fillStyle = 'rgba(0, 242, 255, 0.3)';
          ctx.beginPath(); ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2); ctx.fill();
        }
        if (enemy.burned > 0) {
          ctx.fillStyle = 'rgba(255, 68, 0, 0.3)';
          ctx.beginPath(); ctx.arc(enemy.pos.x, enemy.pos.y, enemy.radius, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Draw Projectiles
      projectilesRef.current.forEach(p => {
        ctx.fillStyle = p.isFire ? '#ff4400' : '#f3ba2f';
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, wave, upgrades]);

  // --- Resize Handler ---
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-white font-sans overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block touch-none"
      />

      {/* HUD */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 pointer-events-none">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
          <div className="w-12 h-12 bg-[#f3ba2f] rounded-full flex items-center justify-center text-2xl font-bold">₿</div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 font-bold">Bitcoin Core HP</div>
            <div className="w-48 h-2 bg-white/10 rounded-full mt-1 overflow-hidden">
              <motion.div 
                className="h-full bg-[#f3ba2f]"
                initial={{ width: '100%' }}
                animate={{ width: `${hp}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Coins className="text-[#f3ba2f]" size={20} />
            <span className="text-2xl font-black italic">{coins.toLocaleString()}</span>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
            <Trophy className="text-[#00f2ff]" size={20} />
            <span className="text-2xl font-black italic">{score.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/10 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-white/40 font-bold">Current Wave</div>
          <div className="text-4xl font-black italic text-[#f3ba2f]">{wave} / 10</div>
        </div>
      </div>

      {/* Upgrades Panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 p-4 bg-black/60 backdrop-blur-xl rounded-3xl border border-white/10">
        {upgrades.map((upgrade) => (
          <button
            key={upgrade.id}
            onClick={() => buyUpgrade(upgrade.id)}
            disabled={coins < upgrade.cost}
            className={`
              group relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all
              ${coins >= upgrade.cost ? 'bg-white/5 hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed'}
            `}
          >
            <div className={`p-3 rounded-xl ${upgrade.level > 0 ? 'bg-[#f3ba2f] text-black' : 'bg-white/10 text-white'}`}>
              {upgrade.icon}
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider">{upgrade.name}</div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#f3ba2f]">
              <Coins size={12} /> {upgrade.cost}
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white text-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
              {upgrade.level}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 p-3 bg-black border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="text-xs font-bold mb-1">{upgrade.name}</div>
              <div className="text-[10px] text-white/40 leading-relaxed">{upgrade.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center z-[100]"
          >
            <div className="w-32 h-32 bg-[#f3ba2f] rounded-full flex items-center justify-center text-6xl font-bold mb-8 shadow-[0_0_50px_rgba(243,186,47,0.4)]">₿</div>
            <h1 className="text-7xl font-black italic tracking-tighter uppercase mb-2">Crypto TD</h1>
            <p className="text-white/40 uppercase tracking-[0.4em] text-xs mb-12">Protect the Bitcoin Core</p>
            <button 
              onClick={resetGame}
              className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-3"
            >
              Start Defense <Play className="w-5 h-5 fill-current" />
            </button>
          </motion.div>
        )}

        {gameState === 'GAMEOVER' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-950/40 backdrop-blur-xl flex flex-col items-center justify-center z-[100]"
          >
            <h2 className="text-8xl font-black italic text-white mb-2">LIQUIDATED</h2>
            <p className="text-white/60 uppercase tracking-widest text-sm mb-12">The Bitcoin Core has been breached</p>
            
            <div className="bg-black/40 p-8 rounded-3xl border border-white/10 mb-12 w-full max-w-sm">
              <div className="flex justify-between items-center mb-4">
                <span className="text-white/40 uppercase text-xs font-bold">Final Score</span>
                <span className="text-3xl font-black italic">{score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase text-xs font-bold">Waves Survived</span>
                <span className="text-3xl font-black italic">{wave - 1}</span>
              </div>
            </div>

            <button 
              onClick={resetGame}
              className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-3"
            >
              Try Again <RotateCcw className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {gameState === 'WIN' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xl flex flex-col items-center justify-center z-[100]"
          >
            <Trophy className="w-24 h-24 text-[#00ff88] mb-8" />
            <h2 className="text-8xl font-black italic text-white mb-2">MOON!</h2>
            <p className="text-white/60 uppercase tracking-widest text-sm mb-12">You defended the core against all odds</p>
            
            <div className="bg-black/40 p-8 rounded-3xl border border-white/10 mb-12 w-full max-w-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white/40 uppercase text-xs font-bold">Total Profit</span>
                <span className="text-3xl font-black italic text-[#00ff88]">{score.toLocaleString()}</span>
              </div>
            </div>

            <button 
              onClick={resetGame}
              className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-3"
            >
              Play Again <RotateCcw className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 right-8 text-white/20 uppercase text-[10px] tracking-[0.5em] font-bold">
        Click enemies to prioritize targets
      </div>
    </div>
  );
}
