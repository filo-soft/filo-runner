import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, CodeXml, Crown, Flag, Home, Landmark, Maximize2, Minimize2, Pause, Play, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import qrUrl from './assets/qr.svg';
import { RunnerGame, type Action, type Mode, type Stats } from './game';

type RecordEntry = Stats & { date: string };
type Panel = 'how' | 'scores' | null;
const emptyStats: Stats = { distance: 0, coins: 0, time: 0, score: 0 };
const format = (n: number) => Math.floor(n).toLocaleString('ru-RU');
const timeFormat = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

function loadRecords(): RecordEntry[] {
  try {
    const data = JSON.parse(localStorage.getItem('filo-records') || '[]');
    return Array.isArray(data) ? data.filter(r => r && Number.isFinite(r.score) && Number.isFinite(r.distance) && Number.isFinite(r.coins)).sort((a, b) => b.score - a.score).slice(0, 5) : [];
  } catch { return []; }
}

function Key({ children }: { children: React.ReactNode }) { return <kbd>{children}</kbd>; }

export default function App() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const gameRef = useRef<RunnerGame | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [panel, setPanel] = useState<Panel>(null);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [records, setRecords] = useState<RecordEntry[]>(loadRecords);
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState('');
  const [newBest, setNewBest] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef({ mode, panel }); stateRef.current = { mode, panel };
  const touch = useRef<{ x: number; y: number; id: number } | null>(null);
  const best = records.reduce((n, r) => Math.max(n, r.distance), 0);

  useEffect(() => {
    if (!sceneRef.current) return;
    try {
      const game = new RunnerGame(sceneRef.current, setStats, final => {
        const previous = loadRecords();
        setNewBest(final.score > (previous[0]?.score || 0));
        const next = [...previous, { ...final, distance: Math.floor(final.distance), time: Math.floor(final.time), date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }].sort((a, b) => b.score - a.score).slice(0, 5);
        try { localStorage.setItem('filo-records', JSON.stringify(next)); } catch { /* Play remains available without storage. */ }
        setRecords(next); setMode('over');
      }, text => {
        setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2400);
      });
      gameRef.current = game; setReady(true);
      return () => { clearTimeout(toastTimer.current); game.dispose(); gameRef.current = null; };
    } catch (e) { console.error('Unable to initialize 3D renderer', e); setError(true); }
  }, []);

  const start = () => {
    if (!gameRef.current) return;
    setPanel(null); setMode('playing'); setStats(emptyStats); setNewBest(false); gameRef.current.start();
    (document.activeElement as HTMLElement)?.blur(); stageRef.current?.focus({ preventScroll: true });
  };
  const home = () => { gameRef.current?.menu(); setMode('menu'); setPanel(null); setToast(''); requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true })); };
  const pause = () => { if (gameRef.current?.mode === 'playing') { gameRef.current.pause(); setMode('paused'); setToast(''); } };
  const resume = () => { setPanel(null); gameRef.current?.resume(); setMode('playing'); stageRef.current?.focus({ preventScroll: true }); };
  const closePanel = () => { setPanel(null); if (mode === 'menu') requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true })); };
  const toggleSound = () => { if (gameRef.current) setSound(gameRef.current.toggleSound()); };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stageRef.current?.requestFullscreen(); } catch { setToast('Полноэкранный режим недоступен в этом браузере'); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2500); }
  };

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const { mode: m, panel: p } = stateRef.current;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault(); if (p) setPanel(null); else if (m === 'playing') pause(); else if (m === 'paused') resume(); return;
      }
      if (p || e.repeat) return;
      if (e.code === 'KeyR' && m !== 'menu') { e.preventDefault(); start(); return; }
      if (e.code === 'Space') {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        e.preventDefault(); if (m === 'menu' || m === 'over') start(); else if (m === 'paused') resume(); else gameRef.current?.control('up'); return;
      }
      const actions: Record<string, Action> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
      if (actions[e.code] && m === 'playing') { e.preventDefault(); gameRef.current?.control(actions[e.code]); }
    };
    const visibility = () => { if (document.hidden) pause(); };
    const fsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', keydown); window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('fullscreenchange', fsChange);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fsChange); };
  }, []);

  const showModal = panel !== null || mode === 'paused' || mode === 'over';
  useEffect(() => {
    if (!showModal) return;
    const frame = requestAnimationFrame(() => modalRef.current?.focus({ preventScroll: true }));
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;
      const buttons = [...modalRef.current.querySelectorAll<HTMLButtonElement>('button')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap); return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', trap); };
  }, [showModal, panel, mode]);

  return (
    <div className="app">
      <main ref={stageRef} className={`stage ${mode === 'menu' ? 'is-menu' : ''}`} tabIndex={-1} aria-label="Filo Runner"
        onPointerDown={e => { if (mode !== 'playing' || (e.target as HTMLElement).closest('button')) return; touch.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { const t = touch.current; if (!t || t.id !== e.pointerId) return; const dx = e.clientX - t.x, dy = e.clientY - t.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) { gameRef.current?.control(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'); touch.current = null; } }}
        onPointerUp={() => { touch.current = null; }} onPointerCancel={() => { touch.current = null; }}>
        <div className="scene" ref={sceneRef} />
        <div className="scene-vignette" />
        {mode === 'menu' && <>
          <div className="menu-wash" />
          <div className="scene-top"><button className="round-button" aria-label={sound ? 'Выключить звук' : 'Включить звук'} title={sound ? 'Выключить звук' : 'Включить звук'} onClick={toggleSound}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button></div>
          <section className="intro">
            <div className="eyebrow"><span /> НЕ ПРОСТО БЕГ. ОДИССЕЯ.</div>
            <h1>Filo<span>Runner.</span></h1>
            <button ref={startRef} className="primary start-button" onClick={start} disabled={!ready || error}><span>{error ? '3D НЕДОСТУПНО' : ready ? 'НАЧАТЬ ЗАБЕГ' : 'СОЗДАЁМ ОЛИМПИЮ…'}</span><ArrowRight size={21} /></button>
            <div className="start-meta"><Trophy size={12} /><span>Рекорд <b>{format(best)} м</b></span></div>
            {error && <p className="error-note">Для игры нужен WebGL 2. Попробуй включить аппаратное ускорение или открыть другой браузер.</p>}
          </section>
        </>}
        {mode !== 'menu' && <>
          <div className="hud">
            <div className="hud-distance"><span className="hud-label"><Flag size={12} /> ДИСТАНЦИЯ</span><strong>{format(stats.distance)}<small>м</small></strong><span className="hud-time">{timeFormat(stats.time)} <span>·</span> {stats.time < 30 ? 'НАЧАЛО ОДИССЕИ' : 'В РИТМЕ ЛЕГЕНДЫ'}</span></div>
            <div className="hud-score"><span className="hud-label">ТВОЙ СЧЁТ</span><strong>{String(stats.score).padStart(6, '0')}</strong></div>
            <div className="hud-right"><div className="coin-pill"><span className="coin-symbol"><CodeXml size={18} /></span><b key={stats.coins}>{stats.coins}</b></div><button className="round-button" onClick={toggleSound} aria-label={sound ? 'Выключить звук' : 'Включить звук'}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button className="round-button" onClick={pause} aria-label="Пауза"><Pause size={17} /></button></div>
          </div>
          {mode === 'playing' && <div className="touch-controls"><button onPointerDown={e => { e.preventDefault(); gameRef.current?.control('left'); }} aria-label="Влево"><ArrowLeft /></button><button onPointerDown={e => { e.preventDefault(); gameRef.current?.control('right'); }} aria-label="Вправо"><ArrowRight /></button><span /><button onPointerDown={e => { e.preventDefault(); gameRef.current?.control('down'); }} aria-label="Скольжение"><ArrowDown /></button><button onPointerDown={e => { e.preventDefault(); gameRef.current?.control('up'); }} aria-label="Прыжок"><ArrowUp /></button></div>}
        </>}
        <button className="fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} title="На весь экран">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <div className={`toast ${toast && mode === 'playing' ? 'visible' : ''}`} role="status"><Sparkles size={14} />{toast}</div>
        {showModal && <div className="modal-shade" onClick={e => { if (e.target === e.currentTarget && panel) closePanel(); }}>
          {mode === 'paused' && !panel && <div className="qr-float"><img src={qrUrl} alt="QR-код Filo Runner" /><span>FILO RUNNER</span></div>}
          <div className={`modal ${panel === 'how' ? 'how-modal' : ''}`} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            {panel && <button className="close-button" aria-label="Закрыть" onClick={closePanel}><X size={19} /></button>}
            {panel === 'how' ? <>
              <div className="modal-symbol"><Landmark size={27} /></div><div className="eyebrow">МАЛЕНЬКИЙ ГИД ПО ВЕЛИКОМУ ЗАБЕГУ</div><h2 id="modal-title">Найди свой <em>ритм.</em></h2><p className="modal-copy">Три движения. Бесконечные возможности.</p>
              <div className="how-list">
                <div className="how-row"><div className="how-keys"><ArrowLeft size={19} /><ArrowRight size={19} /></div><div><h3>Выбери свой путь</h3><p>← → или A / D — смена полосы.<br />Обходи высокие колонны.</p></div><span className="obstacle-mini pillar-mini" /></div>
                <div className="how-row"><div className="how-keys"><ArrowUp size={22} /></div><div><h3>Поднимись над обыденным</h3><p>↑, W или пробел — прыжок.<br />Перепрыгивай мраморные блоки.</p></div><span className="obstacle-mini block-mini" /></div>
                <div className="how-row"><div className="how-keys"><ArrowDown size={22} /></div><div><h3>Ниже — значит дальше</h3><p>↓ или S — скольжение под арками.<br />В воздухе — быстрое приземление.</p></div><span className="obstacle-mini arch-mini" /></div>
              </div>
              <div className="how-note">На телефоне — свайпы или кнопки.<br /><b>Очки = метры + монеты × 10.</b> P / Esc — пауза.</div>
              <button className="primary" onClick={mode === 'paused' ? resume : start}><span>{mode === 'paused' ? 'ПРОДОЛЖИТЬ ЗАБЕГ' : 'Я ГОТОВ К ОДИССЕЕ'}</span><ArrowRight size={19} /></button>
            </> : panel === 'scores' ? <>
              <div className="modal-symbol"><Trophy size={27} /></div><div className="eyebrow">ЗАЛ ЛЕГЕНД</div><h2 id="modal-title">Оставь свой <em>след.</em></h2><p className="modal-copy">Пять лучших одиссей на этом устройстве.</p>
              {records.length ? <div className="scores"><div className="score-heading"><span>ЗАБЕГ</span><span>ОЧКИ</span></div>{records.map((r, i) => <div className="score-row" key={`${r.score}-${i}`}><span className={`rank ${i === 0 ? 'first' : ''}`}>{i === 0 ? <Crown size={20} /> : `0${i + 1}`}</span><div><strong>{i === 0 ? 'Легендарная одиссея' : `Одиссея ${i + 1}`}</strong><small>{format(r.distance)} м · {r.coins} монет <span>· {r.date}</span></small></div><b>{format(r.score)}</b></div>)}</div> : <div className="empty-scores"><Flag size={34} strokeWidth={1.1} /><h3>История ещё не написана.</h3><p>Первый забег — первый след.<br />Твоё место в зале легенд уже ждёт.</p></div>}
              <div className="local-note"><Check size={12} /> Сохраняется локально. Без регистрации.</div><button className="primary" onClick={mode === 'paused' ? resume : start}><span>{mode === 'paused' ? 'ПРОДОЛЖИТЬ' : 'ВОЙТИ В ИСТОРИЮ'}</span><ArrowRight size={19} /></button>
            </> : mode === 'paused' ? <>
              <div className="modal-symbol"><Pause size={26} /></div><div className="eyebrow">МИР ПОДОЖДЁТ</div><h2 id="modal-title">Даже легенды<br /><em>отдыхают.</em></h2><p className="modal-copy">Выдохни. Твоя одиссея никуда не спешит.</p>
              <div className="stats"><div><b>{format(stats.distance)}<small> м</small></b><span>ДИСТАНЦИЯ</span></div><div><b>{stats.coins}</b><span>МОНЕТЫ</span></div><div><b>{timeFormat(stats.time)}</b><span>ВРЕМЯ</span></div></div>
              <button className="primary pulse" onClick={resume}><span>ПРОДОЛЖИТЬ ЗАБЕГ</span><Play size={17} /></button><button className="secondary" onClick={start}><RotateCcw size={14} /> Начать заново <Key>R</Key></button><button className="text-button" onClick={home}><Home size={13} /> Вернуться в храм</button>
            </> : <>
              <div className="modal-symbol"><span className="laurel">❧</span><CodeXml size={25} /><span className="laurel flipped">❧</span></div><div className="eyebrow">У КАЖДОЙ ЛЕГЕНДЫ ЕСТЬ ПРОДОЛЖЕНИЕ</div><h2 id="modal-title">Великолепный<br /><em>забег.</em></h2><p className="modal-copy">Мрамор победил в этот раз.<br />Но следующий забег уже ждёт тебя.</p>
              <div className="stats"><div><b>{format(stats.score)}</b><span>ОЧКИ</span></div><div><b>{format(stats.distance)}<small> м</small></b><span>ДИСТАНЦИЯ</span></div><div><b>{stats.coins}</b><span>МОНЕТЫ</span></div></div>
              <div className="record-note">{newBest ? <><Sparkles size={14} /> НОВЫЙ ЛИЧНЫЙ РЕКОРД</> : <>ТВОЯ ОДИССЕЯ · {timeFormat(stats.time)}</>}</div>
              <button className="primary" onClick={start}><span>ЕЩЁ ОДНА ОДИССЕЯ</span><RotateCcw size={18} /></button><button className="secondary" onClick={() => setPanel('scores')}><Trophy size={14} /> Таблица рекордов <ChevronRight size={14} /></button><button className="text-button" onClick={home}><Home size={13} /> Вернуться в храм</button>
            </>}
          </div>
        </div>}
      </main>
    </div>
  );
}