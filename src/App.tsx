import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Layers3,
  MousePointer2,
  Music2,
  Paperclip,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';

type Category = 'documents' | 'images' | 'evidence' | 'contracts';
type IconName = 'text' | 'image' | 'sheet' | 'archive';
type GameStatus = 'menu' | 'playing' | 'over';

type Attachment = {
  id: number;
  name: string;
  type: string;
  category: Category;
  icon: IconName;
  color: string;
  x: number;
  y: number;
  speed: number;
  rotation: number;
};

type Feedback = {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: 'good' | 'bad' | 'combo';
};

const categories: { id: Category; label: string; hint: string; color: string }[] = [
  { id: 'documents', label: 'Documents', hint: 'Specs, notes, exports', color: '#52a9ff' },
  { id: 'images', label: 'Images', hint: 'Screenshots, mockups', color: '#f4bc4e' },
  { id: 'evidence', label: 'Test Evidence', hint: 'Runs, reports, logs', color: '#57d3a0' },
  { id: 'contracts', label: 'Contracts', hint: 'Legal, vendor, SOW', color: '#f07783' },
];

const attachmentSeed: Omit<Attachment, 'id' | 'x' | 'y' | 'speed' | 'rotation'>[] = [
  { name: 'release-notes-v4.pdf', type: 'PDF', category: 'documents', icon: 'text', color: '#52a9ff' },
  { name: 'checkout-final.png', type: 'PNG', category: 'images', icon: 'image', color: '#f4bc4e' },
  { name: 'run-1842-report.csv', type: 'CSV', category: 'evidence', icon: 'sheet', color: '#57d3a0' },
  { name: 'acme-sow-signed.pdf', type: 'PDF', category: 'contracts', icon: 'text', color: '#f07783' },
  { name: 'api-contract-v2.docx', type: 'DOCX', category: 'documents', icon: 'text', color: '#52a9ff' },
  { name: 'mobile-bug-zoom.jpg', type: 'JPG', category: 'images', icon: 'image', color: '#f4bc4e' },
  { name: 'nightly-log-091.txt', type: 'TXT', category: 'evidence', icon: 'text', color: '#57d3a0' },
  { name: 'nda-very-final-final.pdf', type: 'PDF', category: 'contracts', icon: 'text', color: '#f07783' },
  { name: 'test-data-backup.zip', type: 'ZIP', category: 'evidence', icon: 'archive', color: '#57d3a0' },
  { name: 'hero-state@2x.png', type: 'PNG', category: 'images', icon: 'image', color: '#f4bc4e' },
  { name: 'meeting-notes.md', type: 'MD', category: 'documents', icon: 'text', color: '#52a9ff' },
  { name: 'vendor-terms-2025.pdf', type: 'PDF', category: 'contracts', icon: 'text', color: '#f07783' },
];

const getIcon = (icon: IconName, size = 20) => {
  if (icon === 'image') return <FileImage size={size} />;
  if (icon === 'sheet') return <FileSpreadsheet size={size} />;
  if (icon === 'archive') return <FileArchive size={size} />;
  return <FileText size={size} />;
};

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

function App() {
  const [status, setStatus] = useState<GameStatus>('menu');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [beaverAnswer, setBeaverAnswer] = useState<string | null>(null);
  const [marketplaceAnswer, setMarketplaceAnswer] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const idRef = useRef(0);
  const elapsedRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const level = Math.min(5, 1 + Math.floor(elapsed / 25));
  const speedPercent = Math.min(100, 12 + elapsed * 1.05);
  const highScore = Number(localStorage.getItem('apwide-high-score') || 0);

  const playTone = useCallback((frequency: number, duration = 0.08, type: OscillatorType = 'sine') => {
    if (!soundOn) return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioRef.current ??= new AudioContextClass();
    const context = audioRef.current;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }, [soundOn]);

  const addFeedback = useCallback((text: string, kind: Feedback['kind'], x: number, y: number) => {
    const id = Date.now() + Math.random();
    setFeedback((current) => [...current, { id, text, kind, x, y }]);
    window.setTimeout(() => setFeedback((current) => current.filter((item) => item.id !== id)), 900);
  }, []);

  const spawnAttachment = useCallback(() => {
    const template = attachmentSeed[Math.floor(Math.random() * attachmentSeed.length)];
    const id = idRef.current++;
    const t = elapsedRef.current;
    const playWidth = boardRef.current?.clientWidth ?? 1000;
    const maxLeft = window.innerWidth <= 900 ? 45 : Math.max(16, ((playWidth - 312 - 238) / playWidth) * 100);
    setAttachments((current) => [
      ...current,
      {
        ...template,
        id,
        x: 5 + Math.random() * Math.max(10, maxLeft - 5),
        y: -13,
        speed: 0.045 + t * 0.00025 + Math.random() * 0.01,
        rotation: -7 + Math.random() * 14,
      },
    ]);
  }, []);

  const startGame = useCallback(() => {
    setStatus('playing');
    setScore(0);
    setCombo(0);
    setLives(3);
    setElapsed(0);
    elapsedRef.current = 0;
    setAttachments([]);
    setFeedback([]);
    setCountdown(3);
    idRef.current = 0;
    playTone(520, 0.14, 'triangle');
  }, [playTone]);

  const finishGame = useCallback(() => {
    setStatus('over');
    setCountdown(null);
    setAttachments([]);
    setDraggingId(null);
    playTone(120, 0.28, 'sawtooth');
  }, [playTone]);

  useEffect(() => {
    if (status !== 'playing' || countdown !== null) return;
    const timer = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, countdown]);

  useEffect(() => {
    if (status !== 'playing' || countdown !== null) return;
    let timeoutId = window.setTimeout(function tick() {
      spawnAttachment();
      const t = elapsedRef.current;
      const ramp = Math.max(0, t - 15);
      const delay = Math.max(500, 3200 - ramp * 45);
      timeoutId = window.setTimeout(tick, delay);
    }, 3200);
    return () => window.clearTimeout(timeoutId);
  }, [status, countdown, spawnAttachment]);

  useEffect(() => {
    if (status !== 'playing' || countdown === null) return;
    const timer = window.setTimeout(() => {
      setCountdown((value) => {
        if (value === null || value <= 1) {
          spawnAttachment();
          return null;
        }
        return value - 1;
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [status, countdown, spawnAttachment]);

  useEffect(() => {
    if (countdown !== null) playTone(countdown === 1 ? 700 : 480, 0.1, 'square');
  }, [countdown, playTone]);

  useEffect(() => {
    if (status !== 'playing' || countdown !== null) return;
    let frame = 0;
    const animate = () => {
      setAttachments((current) => {
        const moved = current.map((item) => item.id === draggingId ? item : { ...item, y: item.y + item.speed });
        const missed = moved.filter((item) => item.y > 94);
        if (missed.length > 0) {
          setLives((value) => {
            const next = value - missed.length;
            if (next <= 0) finishGame();
            return Math.max(0, next);
          });
          setCombo(0);
          missed.forEach((item) => addFeedback('MISSED', 'bad', item.x, 76));
          playTone(180, 0.12, 'square');
        }
        return moved.filter((item) => item.y <= 94);
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [status, countdown, draggingId, addFeedback, finishGame, playTone]);

  const handleDrop = (category: Category) => {
    if (draggingId === null) return;
    const target = attachments.find((item) => item.id === draggingId);
    if (!target) return;
    const isCorrect = target.category === category;
    const fx = target.x;
    const fy = Math.min(target.y, 72);
    setAttachments((current) => current.filter((item) => item.id !== draggingId));
    setDraggingId(null);
    setHoveredCategory(null);
    if (isCorrect) {
      const nextCombo = combo + 1;
      const points = 100 * Math.min(4, 1 + Math.floor(nextCombo / 3));
      setScore((value) => value + points);
      setCombo(nextCombo);
      addFeedback(nextCombo > 1 ? `+${points}  COMBO x${Math.min(4, 1 + Math.floor(nextCombo / 3))}` : `+${points}`, nextCombo > 1 ? 'combo' : 'good', fx, fy);
      playTone(640 + Math.min(nextCombo, 6) * 45, 0.1, 'sine');
    } else {
      setLives((value) => {
        const next = value - 1;
        if (next <= 0) finishGame();
        return Math.max(0, next);
      });
      setCombo(0);
      addFeedback('WRONG FIELD', 'bad', fx, fy);
      playTone(160, 0.18, 'square');
    }
  };

  const beginDrag = (id: number) => {
    if (status !== 'playing') return;
    setDraggingId(id);
    playTone(280, 0.04, 'sine');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId === null || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const match = categories.find((category) => {
      const element = document.querySelector(`[data-drop-zone="${category.id}"]`);
      if (!element) return false;
      const zone = element.getBoundingClientRect();
      return event.clientX >= zone.left && event.clientX <= zone.right && event.clientY >= zone.top && event.clientY <= zone.bottom;
    });
    setHoveredCategory(match?.id ?? null);
    setAttachments((current) => current.map((item) => item.id === draggingId ? { ...item, x: Math.max(2, Math.min(84, x - 7)), y: Math.max(2, Math.min(88, y - 5)) } : item));
  };

  const releaseDrag = () => {
    if (draggingId === null) return;
    if (hoveredCategory) handleDrop(hoveredCategory);
    else setDraggingId(null);
  };

  const progressLabel = useMemo(() => {
    if (elapsed < 18) return 'Warming up';
    if (elapsed < 36) return 'Getting spicy';
    if (elapsed < 54) return 'Full chaos';
    return 'Unhinged';
  }, [elapsed]);

  const earnedReward = elapsed >= 90;

  useEffect(() => {
    if (status === 'over' && score > highScore) localStorage.setItem('apwide-high-score', String(score));
  }, [status, score, highScore]);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup">
          <div className="logo-frame"><img src="/assets/APWIDE_LOGO_MAIN_WHITE.png" alt="Apwide" draggable={false} onError={(event) => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.nextElementSibling; if (fallback instanceof HTMLElement) fallback.style.display = 'block'; }} /><span className="logo-fallback" aria-hidden="true">APWIDE</span></div>
          <div className="brand-divider" />
          <div className="game-name"><span>JIRA ISSUE</span><strong>FILE FRENZY</strong></div>
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? 'Mute sounds' : 'Turn on sounds'}>
            {soundOn ? <Music2 size={17} /> : <Music2 size={17} className="muted-icon" />}
          </button>
          <button className="icon-button" onClick={() => setShowHelp(true)} aria-label="How to play"><CircleHelp size={18} /></button>
        </div>
      </header>

      {status === 'menu' && (
        <section className="menu-screen">
          <div className="menu-copy">
            <div className="eyebrow"><Sparkles size={15} /> ATTACHMENT TRIAGE UNIT 04</div>
            <h1>Sort the chaos.<br /><em>Save the issue.</em></h1>
            <p className="hero-description">Attachments are incoming and your issue is already on fire. Drag every file into its rightful field before the backlog buries you.</p>
            <div className="menu-buttons">
              <button className="primary-button" onClick={startGame}><Play size={18} fill="currentColor" /> Start sorting <ArrowRight size={17} /></button>
              <button className="secondary-button" onClick={() => setShowHelp(true)}><MousePointer2 size={16} /> How it works</button>
              <button className="secondary-button" onClick={() => setShowOptions(true)}><Settings size={16} /> Options</button>
            </div>
            <div className="best-score"><BarChart3 size={15} /> Personal best <strong>{highScore.toLocaleString().padStart(4, '0')}</strong></div>
          </div>
          <div className="menu-art" aria-hidden="true">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="issue-card">
              <div className="issue-card-header"><span className="jira-dot" /> APW-1842 <span className="status-pill">IN PROGRESS</span></div>
              <div className="issue-title">The attachments have<br />escaped containment.</div>
              <div className="fake-lines"><i /><i /><i /></div>
              <div className="mini-attachment one"><FileText size={17} /><span>scope.pdf</span></div>
              <div className="mini-attachment two"><FileImage size={17} /><span>bug.png</span></div>
              <div className="mini-attachment three"><FileArchive size={17} /><span>logs.zip</span></div>
              <div className="beaver-helper"><img src="/assets/beaverhead.png" alt="Apwide beaver helper" onError={(event) => { event.currentTarget.src = '/assets/beaver.png'; event.currentTarget.classList.add('beaver-fallback'); }} /></div>
              <div className="beaver-speech"><strong>Beaver says:</strong><span>If you can last 1 minute and 30 seconds, you will receive a secret reward!</span><i /></div>
            </div>
            <div className="float-tag tag-one"><Paperclip size={13} /> 12 files pending</div>
            <div className="float-tag tag-two"><Gauge size={13} /> chaos level rising</div>
          </div>
        </section>
      )}

      {status !== 'menu' && (
        <section className="game-screen">
          <div className="game-header">
            <div className="issue-heading"><div className="issue-key"><span className="jira-dot" /> APW-1842</div><h2>The attachments have escaped containment.</h2><div className="issue-meta"><span><Layers3 size={13} /> 4 File Fields</span></div></div>
            <div className="stats-row">
              <div className="stat-block"><span>SCORE</span><strong>{score.toLocaleString().padStart(4, '0')}</strong></div>
              <div className="stat-block timer-stat"><span>TIME</span><strong>{formatDuration(elapsed)}</strong></div>
              <div className="stat-block combo-stat"><span>COMBO</span><strong>{combo > 1 ? `x${Math.min(4, 1 + Math.floor(combo / 3))}` : '—'}</strong></div>
              <div className="lives-block" aria-label={`${lives} lives remaining`}><span>LIVES</span><div className="life-dots">{[0, 1, 2].map((life) => <i key={life} className={life < lives ? 'alive' : ''} />)}</div></div>
            </div>
          </div>
          <div className="progress-strip"><span>THREAT LEVEL <strong>{progressLabel}</strong></span><div className="threat-track"><i style={{ width: `${speedPercent}%` }} /></div><span>LVL 0{level}</span></div>
          <div className="game-layout" ref={boardRef} onPointerMove={handlePointerMove} onPointerUp={releaseDrag} onPointerLeave={() => { if (draggingId !== null) setHoveredCategory(null); }}>
            <div className="board-wrap">
              <div className="board-label"><span><span className="live-dot" /> LIVE INCOMING</span><span>{attachments.length} loose {attachments.length === 1 ? 'file' : 'files'}</span></div>
              <div className="board"><div className="grid-lines" />{attachments.length === 0 && <div className="empty-board"><FolderOpen size={29} /><strong>Clear skies… for now.</strong><span>Incoming files will land here.</span></div>}</div>
            </div>
            {attachments.map((attachment) => (
              <div key={attachment.id} className={`attachment ${draggingId === attachment.id ? 'is-dragging' : ''}`} style={{ left: `${attachment.x}%`, top: `${attachment.y}%`, transform: `rotate(${attachment.rotation}deg)`, '--file-color': attachment.color } as React.CSSProperties} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginDrag(attachment.id); }} onDragStart={(event) => event.preventDefault()}>
                <div className="file-icon">{getIcon(attachment.icon)}</div><div className="file-copy"><strong>{attachment.name}</strong><span>{attachment.type} · attachment</span></div><div className="drag-grip"><ChevronRight size={15} /></div>
              </div>
            ))}
            {feedback.map((item) => <div key={item.id} className={`feedback ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.kind === 'good' ? <Check size={14} /> : item.kind === 'bad' ? <X size={14} /> : <Zap size={14} />}{item.text}</div>)}
            {countdown !== null && <div className="countdown-overlay"><span>GET READY</span><strong>{countdown}</strong><small>First attachment incoming</small></div>}
            <aside className="fields-panel"><div className="fields-heading"><div><span>DROP ZONES</span><strong>File Fields</strong></div><Archive size={18} /></div><p className="fields-instruction">Drag each attachment to the field that knows what to do with it.</p><div className="drop-zones">{categories.map((category) => <div key={category.id} data-drop-zone={category.id} className={`drop-zone ${hoveredCategory === category.id ? 'is-hovered' : ''}`} style={{ '--zone-color': category.color } as React.CSSProperties} onPointerUp={() => handleDrop(category.id)}><div className="zone-icon">{category.id === 'documents' ? <FileText size={18} /> : category.id === 'images' ? <ImageIcon size={18} /> : category.id === 'evidence' ? <TriangleAlert size={18} /> : <Archive size={18} />}</div><div><strong>{category.label}</strong><span>{category.hint}</span></div><ArrowRight size={16} className="zone-arrow" /></div>)}</div><div className="helper-card"><div className="helper-face"><img src="/assets/beaverhead.png" alt="Apwide beaver helper" onError={(event) => { event.currentTarget.src = '/assets/beaver.png'; event.currentTarget.classList.add('beaver-fallback'); }} /></div><div><strong>Beaver says:</strong><p>{combo >= 3 ? 'Keep it moving. Very nice.' : 'Sort fast. Think faster.'}</p></div></div></aside>
          </div>
        </section>
      )}

      {status === 'over' && <div className="modal-backdrop"><div className="game-over-card"><div className="over-icon"><TriangleAlert size={25} /></div><div className="eyebrow">ISSUE STATUS: BLOCKED</div><h2>Buried in attachments.</h2><p>The backlog won this round, but the issue is still recoverable.</p><div className="final-stats"><div><span>FINAL SCORE</span><strong>{score.toLocaleString().padStart(4, '0')}</strong></div><div><span>TIME SURVIVED</span><strong>{formatDuration(elapsed)}</strong></div><div><span>BEST COMBO</span><strong>{combo > 0 ? `x${Math.min(4, 1 + Math.floor(combo / 3))}` : '—'}</strong></div></div>{earnedReward && <p className="reward-message">Congratulations! The Beaver is proud of you! Write an email to partners@apwide.com and screenshot your score, and you'll receive a secret reward!</p>}<button className="primary-button full-button" onClick={startGame}><RotateCcw size={17} /> Try again</button><button className="text-button" onClick={() => setStatus('menu')}>Back to briefing</button></div></div>}
      {showHelp && <div className="modal-backdrop help-backdrop" onPointerDown={(event) => { if (event.currentTarget === event.target) setShowHelp(false); }}><div className="help-card"><button className="close-button" onClick={() => setShowHelp(false)}><X size={17} /></button><div className="eyebrow"><MousePointer2 size={14} /> FIELD MANUAL</div><h2>Keep the issue tidy.</h2><div className="help-steps"><div><b>01</b><span>Grab a falling attachment by its card.</span></div><div><b>02</b><span>Drop it into the matching File Field.</span></div><div><b>03</b><span>Build combos for bigger points. Miss three and the issue is blocked.</span></div></div><button className="primary-button full-button" onClick={() => { setShowHelp(false); if (status === 'menu') startGame(); }}>Got it, start sorting <ArrowRight size={16} /></button></div></div>}
      {showOptions && <div className="modal-backdrop" onPointerDown={(event) => { if (event.currentTarget === event.target) setShowOptions(false); }}><div className="options-card"><button className="close-button" onClick={() => setShowOptions(false)}><X size={17} /></button><div className="eyebrow"><Settings size={14} /> PLAYER OPTIONS</div><h2>Important questions.</h2><div className="option-group"><strong>Do you like beavers?</strong><div className="option-buttons"><button className={beaverAnswer === 'No, I LOVE BEAVERS' ? 'option-button selected' : 'option-button'} onClick={() => setBeaverAnswer('No, I LOVE BEAVERS')}>No, I LOVE BEAVERS</button><button className={beaverAnswer === 'Yes' ? 'option-button selected' : 'option-button'} onClick={() => setBeaverAnswer('Yes')}>Yes</button></div></div><div className="option-group"><strong>According to you, which Marketplace Partner produces the best Jira apps?</strong><div className="option-buttons"><button className={marketplaceAnswer === 'Apwide' ? 'option-button selected' : 'option-button'} onClick={() => setMarketplaceAnswer('Apwide')}>Apwide</button></div></div></div></div>}
    </main>
  );
}

export default App;
