import { useState, useCallback } from 'react';
import type {
  TributeInput, Relationship, SimulationSettings,
  SimulationResult, ResolvedEvent, ApiResponse,
  PronounType,
} from './types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function formatStage(stage: string) {
  const map: Record<string, string> = {
    bloodbath: 'The Bloodbath',
    day: 'Day',
    night: 'Night',
    feast: 'The Feast',
    all: 'Arena',
  };
  return map[stage] ?? stage;
}

function deathCauseLabel(cause: string) {
  const map: Record<string, string> = {
    killed:     'was killed',
    accident:   'died in an accident',
    environment:'succumbed to the arena',
    self:       'took their own life',
    infection:  'died from infection',
    exposure:   'died from exposure',
    hunger:     'died of hunger',
    thirst:     'died of thirst',
  };
  return map[cause] ?? 'died';
}

const STAGE_ICONS: Record<string, string> = {
  bloodbath: '⚔',
  day: '☀',
  night: '☾',
  feast: '✦',
  all: '◆',
};

const DEATH_CAUSE_COLORS: Record<string, string> = {
  killed:     'tag-red',
  accident:   'tag-gray',
  environment:'tag-gray',
  self:       'tag-gray',
  infection:  'tag-blue',
  exposure:   'tag-blue',
  hunger:     'tag-blue',
  thirst:     'tag-blue',
};

// ─────────────────────────────────────────────────────────────
// TributeCard
// ─────────────────────────────────────────────────────────────

interface TributeCardProps {
  tribute: TributeInput;
  isAlive?: boolean;
  deathRound?: number;
  deathCause?: string;
  kills?: number;
  compact?: boolean;
  onRemove?: () => void;
  onRelation?: () => void;
  relations?: { allies: number; enemies: number };
}

function TributeCard({ tribute, isAlive = true, deathRound: _deathRound, deathCause, kills = 0, compact = false, onRemove, onRelation, relations }: TributeCardProps) {
  const initials = tribute.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn('tribute-card', !isAlive && 'tribute-card--dead', compact && 'tribute-card--compact', 'animate-fade-up')}>
      {/* Avatar */}
      <div className="tribute-card__avatar">
        {tribute.imageUrl ? (
          <img src={tribute.imageUrl} alt={tribute.name} className="tribute-card__img" />
        ) : (
          <span className="tribute-card__initials">{initials}</span>
        )}
        {!isAlive && <div className="tribute-card__dead-overlay" />}
      </div>

      {/* Info */}
      <div className="tribute-card__info">
        <div className="tribute-card__name">{tribute.name}</div>
        <div className="tribute-card__meta">
          <span className="tag tag-gray">{tribute.pronouns}</span>
          {tribute.district && <span className="tag tag-gold">{tribute.district}</span>}
          {!isAlive && deathCause && (
            <span className={cn('tag', DEATH_CAUSE_COLORS[deathCause] ?? 'tag-gray')}>
              {deathCauseLabel(deathCause)}
            </span>
          )}
        </div>
        {!compact && tribute.skills.length > 0 && (
          <div className="tribute-card__skills">
            {tribute.skills.map(s => (
              <span key={s} className="tribute-card__skill">{s}</span>
            ))}
          </div>
        )}
        {!compact && (
          <div className="tribute-card__stats">
            {kills > 0 && <span className="tribute-card__stat tribute-card__stat--kills">⚔ {kills} kill{kills !== 1 ? 's' : ''}</span>}
            {relations && (relations.allies > 0 || relations.enemies > 0) && (
              <span className="tribute-card__stat">
                {relations.allies > 0 && <span className="tribute-card__stat--ally">♥ {relations.allies}</span>}
                {' '}
                {relations.enemies > 0 && <span className="tribute-card__stat--enemy">⚔ {relations.enemies}</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="tribute-card__actions">
        {onRelation && (
          <button className="btn btn-ghost btn-icon tribute-card__action-btn" onClick={onRelation} title="Set relationship">
            ⚡
          </button>
        )}
        {onRemove && (
          <button className="btn btn-ghost btn-icon tribute-card__action-btn tribute-card__remove" onClick={onRemove} title="Remove">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RelationshipModal
// ─────────────────────────────────────────────────────────────

interface RelationshipModalProps {
  tributes: TributeInput[];
  relationships: Relationship[];
  onClose: () => void;
  onSave: (relationships: Relationship[]) => void;
}

function RelationshipModal({ tributes, relationships, onClose, onSave }: RelationshipModalProps) {
  const [local, setLocal] = useState<Relationship[]>([...relationships]);

  const setRel = (from: string, to: string, type: Relationship['type'] | null) => {
    setLocal(prev => {
      const without = prev.filter(r => !(r.from === from && r.to === to) && !(r.from === to && r.to === from));
      if (type === null) return without;
      return [...without, { from, to, type, strength: 3 }];
    });
  };

  const getRel = (a: string, b: string) => {
    return local.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-down" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal__header">
          <h2 className="modal__title">Alliance & Rivalry</h2>
          <p className="modal__subtitle">Define the relationships between your tributes. Allies are less likely to kill each other.</p>
        </div>

        <div className="modal__body" style={{ maxHeight: 500, overflowY: 'auto' }}>
          <div className="rel-grid">
            {tributes.map(t1 => (
              <div key={t1.id} className="rel-row">
                <div className="rel-row__name">{t1.name}</div>
                <div className="rel-row__connections">
                  {tributes.filter(t2 => t2.id !== t1.id).map(t2 => {
                    const rel = getRel(t1.id, t2.id);
                    return (
                      <button
                        key={t2.id}
                        className={cn('rel-chip', rel && `rel-chip--${rel.type}`)}
                        onClick={() => setRel(t1.id, t2.id, rel ? null : 'ally')}
                        title={`${t1.name} → ${t2.name}`}
                      >
                        {rel ? (rel.type === 'ally' ? '♥' : '⚔') : '–'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rel-legend">
            <span className="rel-legend__item rel-chip rel-chip--ally">♥ Allied</span>
            <span className="rel-legend__item rel-chip rel-chip--enemy">⚔ Enemy</span>
            <span className="rel-legend__item">— Click to cycle</span>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(local)}>Save Relationships</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EventCard
// ─────────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: ResolvedEvent; index: number }) {
  const icon = STAGE_ICONS[event.stage] ?? '◆';
  const isFatal = event.deaths.length > 0;

  return (
    <div
      className={cn('event-card', isFatal && 'event-card--fatal', 'animate-fade-up')}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="event-card__header">
        <span className="event-card__icon">{icon}</span>
        <span className={cn('event-card__stage', `event-card__stage--${event.stage}`)}>
          {formatStage(event.stage)} · Round {event.round}
        </span>
        {isFatal && (
          <div className="event-card__deaths">
            {event.deaths.map(d => (
              <span key={d.tributeId} className="event-card__death-name">✕ {d.tributeName}</span>
            ))}
          </div>
        )}
      </div>
      <p className="event-card__message">{event.message}</p>
      <div className="event-card__footer">
        {event.tags.slice(0, 3).map(tag => (
          <span key={tag} className="tag tag-gray">{tag}</span>
        ))}
        {isFatal && <span className={cn('tag', DEATH_CAUSE_COLORS[event.cause] ?? 'tag-gray')}>{event.cause}</span>}
        {event.killers.length > 0 && (
          <span className="tag tag-gold">
            ⚔ {event.killers.map(k => k.tributeName).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Results Panel
// ─────────────────────────────────────────────────────────────

function ResultsPanel({ result, onReset }: { result: SimulationResult; onReset: () => void }) {
  const winner = result.winner;

  return (
    <div className="results-panel animate-fade-in">
      {/* Winner banner */}
      {winner && (
        <div className="winner-banner card card-gold animate-fade-up">
          <div className="winner-banner__crown">♛</div>
          <div className="winner-banner__label">The Victor</div>
          <div className="winner-banner__name">{winner.name}</div>
          <div className="winner-banner__pronoun">{winner.pronouns}</div>
        </div>
      )}

      {/* Stats bar */}
      <div className="results-stats animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="results-stats__item">
          <span className="results-stats__value">{result.totalRounds}</span>
          <span className="results-stats__label">Rounds</span>
        </div>
        <div className="results-stats__divider" />
        <div className="results-stats__item">
          <span className="results-stats__value results-stats__value--red">{result.metadata.totalDeaths}</span>
          <span className="results-stats__label">Deaths</span>
        </div>
        <div className="results-stats__divider" />
        <div className="results-stats__item">
          <span className="results-stats__value">{result.tributeStats.length - result.metadata.totalDeaths}</span>
          <span className="results-stats__label">Survivors</span>
        </div>
      </div>

      {/* Final standings */}
      <div className="results-standings card animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h3 className="results-standings__title">Final Standings</h3>
        <div className="results-standings__list">
          {result.tributeStats
            .sort((a, b) => {
              if (a.alive && !b.alive) return -1;
              if (!a.alive && b.alive) return 1;
              if (b.kills !== a.kills) return b.kills - a.kills;
              return (b.deathRound ?? 9999) - (a.deathRound ?? 9999);
            })
            .map((t, idx) => (
              <div key={t.id} className={cn('results-standings__row', !t.alive && 'results-standings__row--dead')}>
                <span className="results-standings__rank">
                  {idx === 0 ? '♛' : `#${idx + 1}`}
                </span>
                <div className="results-standings__info">
                  <span className="results-standings__name">{t.name}</span>
                  <span className="results-standings__detail">
                    {t.alive ? 'Survived' : `Died Round ${t.deathRound}`}
                    {!t.alive && ` · ${deathCauseLabel(t.deathCause)}`}
                  </span>
                </div>
                <span className="results-standings__kills">⚔ {t.kills}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Event log */}
      <div className="results-log animate-fade-up" style={{ animationDelay: '300ms' }}>
        <h3 className="results-log__title">Chronicle of the Games</h3>
        {result.allRounds.map((round, ri) => (
          <div key={ri} className="results-log__round">
            <div className="results-log__round-header">
              {round.roundNumber === 0 ? 'The Bloodbath' : `Round ${round.roundNumber}`}
              <span className="results-log__round-survivors">
                {round.survivors.length} alive
              </span>
            </div>

            {round.bloodbathPhase?.map((e, i) => (
              <EventCard key={`bb-${i}`} event={e} index={i} />
            ))}
            {round.dayPhase?.map((e, i) => (
              <EventCard key={`d-${i}`} event={e} index={i + 4} />
            ))}
            {round.nightPhase?.map((e, i) => (
              <EventCard key={`n-${i}`} event={e} index={i + 8} />
            ))}
            {round.feastPhase?.map((e, i) => (
              <EventCard key={`f-${i}`} event={e} index={i + 12} />
            ))}
          </div>
        ))}
      </div>

      <div className="results-actions animate-fade-up" style={{ animationDelay: '400ms' }}>
        <button className="btn btn-primary" onClick={onReset}>
          Run Another Simulation
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AddTribute Form
// ─────────────────────────────────────────────────────────────

interface AddTributeFormProps {
  onAdd: (tribute: TributeInput) => void;
}

function AddTributeForm({ onAdd }: AddTributeFormProps) {
  const [name, setName] = useState('');
  const [pronouns, setPronouns] = useState<PronounType>('they/them');
  const [district, setDistrict] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setSkillInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: uid(), name: name.trim(), pronouns, district: district.trim() || undefined, imageUrl: imageUrl.trim() || undefined, skills });
    setName('');
    setPronouns('they/them');
    setDistrict('');
    setImageUrl('');
    setSkills([]);
  };

  return (
    <form className="add-tribute-form card" onSubmit={handleSubmit}>
      <h3 className="add-tribute-form__title">Add Tribute</h3>
      <div className="add-tribute-form__grid">
        <div className="add-tribute-form__field">
          <label className="label" htmlFor="tribute-name">Name *</label>
          <input
            id="tribute-name"
            className="input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Katniss Everdeen"
            required
            maxLength={60}
          />
        </div>
        <div className="add-tribute-form__field">
          <label className="label" htmlFor="tribute-pronouns">Pronouns</label>
          <select
            id="tribute-pronouns"
            className="input"
            value={pronouns}
            onChange={e => setPronouns(e.target.value as PronounType)}
          >
            <option value="he/him">he/him</option>
            <option value="she/her">she/her</option>
            <option value="they/them">they/them</option>
            <option value="they/them (plural)">they/them (plural)</option>
          </select>
        </div>
        <div className="add-tribute-form__field">
          <label className="label" htmlFor="tribute-district">District</label>
          <input
            id="tribute-district"
            className="input"
            type="text"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            placeholder="e.g. District 12"
            maxLength={30}
          />
        </div>
        <div className="add-tribute-form__field">
          <label className="label" htmlFor="tribute-image">Image URL</label>
          <input
            id="tribute-image"
            className="input"
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="add-tribute-form__field add-tribute-form__field--full">
          <label className="label" htmlFor="tribute-skill">Skills</label>
          <div className="add-tribute-form__skill-row">
            <input
              id="tribute-skill"
              className="input"
              type="text"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
              placeholder="e.g. Archery, Stealth..."
            />
            <button type="button" className="btn btn-ghost" onClick={handleAddSkill}>+</button>
          </div>
          {skills.length > 0 && (
            <div className="add-tribute-form__skills">
              {skills.map(s => (
                <span key={s} className="tribute-card__skill">
                  {s}
                  <button type="button" className="tribute-card__skill-remove" onClick={() => setSkills(prev => prev.filter(x => x !== s))}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={!name.trim()}>
        + Add to Roster
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SimulationSettings = {
  deathsPerRound: 0,
  startOnDay: 0,
  maxRounds: 50,
  feastEnabled: true,
};

export default function App() {
  const [tributes, setTributes] = useState<TributeInput[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRelModal, setShowRelModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'results' | 'standings'>('setup');

  // ── Tribute management ──────────────────────────────────

  const addTribute = useCallback((t: TributeInput) => {
    setTributes(prev => [...prev, t]);
  }, []);

  const removeTribute = useCallback((id: string) => {
    setTributes(prev => prev.filter(t => t.id !== id));
    setRelationships(prev => prev.filter(r => r.from !== id && r.to !== id));
  }, []);

  const handleRelationsSave = useCallback((rels: Relationship[]) => {
    setRelationships(rels);
    setShowRelModal(false);
  }, []);

  // ── Simulation ───────────────────────────────────────────

  const runSimulation = useCallback(async () => {
    if (tributes.length < 2) {
      setError('You need at least 2 tributes to run a simulation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tributes, relationships, settings }),
      });

      const json: ApiResponse<SimulationResult> = await res.json();

      if (!json.success || !json.data) {
        setError(json.error ?? 'Simulation failed. Please try again.');
        setLoading(false);
        return;
      }

      setResult(json.data);
      setActiveTab('results');
    } catch {
      setError('Could not connect to the simulation server. Is it running?');
    } finally {
      setLoading(false);
    }
  }, [tributes, relationships, settings]);

  const reset = () => {
    setResult(null);
    setActiveTab('setup');
    setError(null);
  };

  const aliveCount = result
    ? result.allRounds[result.allRounds.length - 1]?.survivors.length ?? 0
    : tributes.length;

  const getRelationsForTribute = (id: string) => {
    const allies = relationships.filter(r => (r.from === id || r.to === id) && r.type === 'ally').length;
    const enemies = relationships.filter(r => (r.from === id || r.to === id) && r.type === 'enemy').length;
    return { allies, enemies };
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="container app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__logo">⚔</span>
            <div>
              <h1 className="app-header__title">Arena</h1>
              <p className="app-header__tagline">The Hunger Games Simulator</p>
            </div>
          </div>
          <div className="app-header__stats">
            <div className="app-header__stat">
              <span className="app-header__stat-value">{aliveCount}</span>
              <span className="app-header__stat-label">Tributes</span>
            </div>
            <div className="app-header__stat">
              <span className="app-header__stat-value">{relationships.filter(r => r.type === 'ally').length}</span>
              <span className="app-header__stat-label">Alliances</span>
            </div>
            {result && (
              <div className="app-header__stat">
                <span className="app-header__stat-value app-header__stat-value--red">
                  {result.metadata.totalDeaths}
                </span>
                <span className="app-header__stat-label">Deaths</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">

          {/* Results view */}
          {result && activeTab === 'results' && (
            <ResultsPanel result={result} onReset={reset} />
          )}

          {/* Setup view */}
          {activeTab === 'setup' && (
            <div className="setup-layout animate-fade-up">

              {/* Tribute roster */}
              <section className="setup-section">
                <div className="setup-section__header">
                  <h2 className="setup-section__title">Tribute Roster</h2>
                  {tributes.length > 0 && (
                    <div className="setup-section__header-actions">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setShowRelModal(true)}
                        disabled={tributes.length < 2}
                      >
                        ⚡ Set Relationships
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => { setTributes([]); setRelationships([]); }} title="Clear all">
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {tributes.length === 0 && (
                  <div className="setup-empty">
                    <div className="setup-empty__icon">⚔</div>
                    <p className="setup-empty__text">No tributes yet. Add your first tribute below.</p>
                  </div>
                )}

                <div className="tribute-grid">
                  {tributes.map(t => (
                    <TributeCard
                      key={t.id}
                      tribute={t}
                      isAlive
                      onRemove={() => removeTribute(t.id)}
                      onRelation={() => { setShowRelModal(true); }}
                      relations={getRelationsForTribute(t.id)}
                    />
                  ))}
                </div>
              </section>

              {/* Add tribute form */}
              <section className="setup-sidebar">
                <AddTributeForm onAdd={addTribute} />

                {/* Relationships summary */}
                {relationships.length > 0 && (
                  <div className="card" style={{ marginTop: 16 }}>
                    <h4 className="card__sub-title">Relationships</h4>
                    <div className="rel-summary">
                      {relationships.map(r => {
                        const fromName = tributes.find(t => t.id === r.from)?.name ?? r.from;
                        const toName = tributes.find(t => t.id === r.to)?.name ?? r.to;
                        return (
                          <div key={`${r.from}-${r.to}`} className={cn('rel-summary__item', `rel-summary__item--${r.type}`)}>
                            <span className="rel-summary__names">
                              {fromName} <strong>{r.type === 'ally' ? '♥' : '⚔'}</strong> {toName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Settings */}
                <div className="card" style={{ marginTop: 16 }}>
                  <h4 className="card__sub-title">Simulation Settings</h4>
                  <div className="settings-form">
                    <label className="settings-form__row">
                      <span className="settings-form__label">Max Rounds</span>
                      <input
                        type="number"
                        className="input settings-form__input"
                        value={settings.maxRounds}
                        min={5}
                        max={200}
                        onChange={e => setSettings(s => ({ ...s, maxRounds: parseInt(e.target.value) || 50 }))}
                      />
                    </label>
                    <label className="settings-form__row">
                      <span className="settings-form__label">Start on Day</span>
                      <input
                        type="number"
                        className="input settings-form__input"
                        value={settings.startOnDay}
                        min={0}
                        max={20}
                        onChange={e => setSettings(s => ({ ...s, startOnDay: parseInt(e.target.value) || 0 }))}
                      />
                    </label>
                    <label className="settings-form__row settings-form__row--toggle">
                      <span className="settings-form__label">Feast Events</span>
                      <div
                        className={cn('toggle', settings.feastEnabled && 'toggle--on')}
                        onClick={() => setSettings(s => ({ ...s, feastEnabled: !s.feastEnabled }))}
                        role="switch"
                        aria-checked={settings.feastEnabled}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setSettings(s => ({ ...s, feastEnabled: !s.feastEnabled })); }}
                      >
                        <div className="toggle__thumb" />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="error-banner animate-slide-down">
                    ✕ {error}
                  </div>
                )}

                {/* Run button */}
                <button
                  className={cn('btn', 'btn-primary', 'run-btn', loading && 'run-btn--loading')}
                  onClick={runSimulation}
                  disabled={loading || tributes.length < 2}
                >
                  {loading ? (
                    <>
                      <span className="run-btn__spinner" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      ⚔ Begin the Games
                    </>
                  )}
                </button>
                {tributes.length > 0 && tributes.length < 2 && (
                  <p className="run-btn__hint">Add at least 2 tributes to begin</p>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Relationship modal */}
      {showRelModal && (
        <RelationshipModal
          tributes={tributes}
          relationships={relationships}
          onClose={() => setShowRelModal(false)}
          onSave={handleRelationsSave}
        />
      )}

      <style>{`
        /* ── App shell ──────────────────────────────────── */
        .app { display: flex; flex-direction: column; min-height: 100dvh; }
        .app-header {
          position: sticky; top: 0; z-index: 50;
          background: rgba(11,11,15,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-subtle);
        }
        .app-header__inner {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 16px; padding-bottom: 16px;
        }
        .app-header__brand { display: flex; align-items: center; gap: 12px; }
        .app-header__logo { font-size: 2rem; }
        .app-header__title {
          font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700;
          color: var(--gold); letter-spacing: 0.08em; margin: 0;
        }
        .app-header__tagline { font-size: 0.75rem; color: var(--text-muted); margin: 0; letter-spacing: 0.05em; }
        .app-header__stats { display: flex; gap: 24px; }
        .app-header__stat { display: flex; flex-direction: column; align-items: center; }
        .app-header__stat-value { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }
        .app-header__stat-value--red { color: var(--crimson); }
        .app-header__stat-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .app-main { flex: 1; padding: 32px 0 64px; }

        /* ── Setup layout ───────────────────────────────── */
        .setup-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .setup-layout { grid-template-columns: 1fr; }
          .setup-sidebar { order: -1; }
        }
        .setup-section { display: flex; flex-direction: column; gap: 16px; }
        .setup-section__header { display: flex; align-items: center; justify-content: space-between; }
        .setup-section__title {
          font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 600;
          color: var(--gold); letter-spacing: 0.05em;
        }
        .setup-section__header-actions { display: flex; gap: 8px; align-items: center; }
        .setup-sidebar { display: flex; flex-direction: column; gap: 0; position: sticky; top: 88px; }

        /* ── Tribute grid ───────────────────────────────── */
        .tribute-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        /* ── Tribute card ───────────────────────────────── */
        .tribute-card {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          transition: border-color var(--transition), box-shadow var(--transition);
        }
        .tribute-card:hover { border-color: var(--gold-dim); box-shadow: var(--shadow-gold); }
        .tribute-card--dead { opacity: 0.5; }
        .tribute-card--compact { padding: 8px 12px; }
        .tribute-card__avatar {
          position: relative; flex-shrink: 0;
          width: 44px; height: 44px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--bg-elevated);
          border: 2px solid var(--border);
          display: flex; align-items: center; justify-content: center;
        }
        .tribute-card__img { width: 100%; height: 100%; object-fit: cover; }
        .tribute-card__initials { font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; color: var(--gold); }
        .tribute-card__dead-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem; color: var(--crimson);
        }
        .tribute-card__info { flex: 1; min-width: 0; }
        .tribute-card__name { font-weight: 600; font-size: 0.95rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tribute-card__meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .tribute-card__skills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .tribute-card__skill {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 7px;
          background: rgba(201,168,76,0.08); color: var(--gold-dim);
          border-radius: 99px; font-size: 0.7rem; font-weight: 500;
        }
        .tribute-card__skill-remove { background: none; border: none; cursor: pointer; color: inherit; font-size: 0.65rem; padding: 0; line-height: 1; }
        .tribute-card__stats { display: flex; gap: 8px; margin-top: 4px; font-size: 0.75rem; }
        .tribute-card__stat { color: var(--text-muted); }
        .tribute-card__stat--kills { color: var(--gold-dim); }
        .tribute-card__stat--ally { color: #2ecc71; }
        .tribute-card__stat--enemy { color: var(--crimson); }
        .tribute-card__actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
        .tribute-card__action-btn { opacity: 0; transition: opacity var(--transition); }
        .tribute-card:hover .tribute-card__action-btn { opacity: 1; }
        .tribute-card__remove:hover { color: var(--crimson) !important; }

        /* ── Empty state ────────────────────────────────── */
        .setup-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 20px; text-align: center;
          background: var(--bg-card); border: 1px dashed var(--border);
          border-radius: var(--radius-xl);
        }
        .setup-empty__icon { font-size: 3rem; margin-bottom: 16px; opacity: 0.3; }
        .setup-empty__text { color: var(--text-muted); font-size: 0.95rem; }

        /* ── Add tribute form ───────────────────────────── */
        .add-tribute-form { }
        .add-tribute-form__title {
          font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 600;
          color: var(--gold); margin-bottom: 16px; letter-spacing: 0.05em;
        }
        .add-tribute-form__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .add-tribute-form__field { display: flex; flex-direction: column; }
        .add-tribute-form__field--full { grid-column: 1 / -1; }
        .add-tribute-form__skill-row { display: flex; gap: 8px; }
        .add-tribute-form__skill-row .input { flex: 1; }
        .add-tribute-form__skills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .add-tribute-form__skills .tribute-card__skill { cursor: default; }

        /* ── Settings form ──────────────────────────────── */
        .card__sub-title {
          font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 600;
          color: var(--gold); margin-bottom: 12px; letter-spacing: 0.04em;
        }
        .settings-form { display: flex; flex-direction: column; gap: 12px; }
        .settings-form__row { display: flex; align-items: center; justify-content: space-between; }
        .settings-form__row--toggle { cursor: pointer; }
        .settings-form__label { font-size: 0.85rem; color: var(--text-secondary); }
        .settings-form__input { width: 80px; text-align: right; }

        /* ── Toggle switch ──────────────────────────────── */
        .toggle {
          width: 44px; height: 24px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: 99px; position: relative; cursor: pointer;
          transition: background var(--transition);
        }
        .toggle--on { background: rgba(201,168,76,0.3); border-color: var(--gold-dim); }
        .toggle__thumb {
          position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px;
          background: var(--text-muted); border-radius: 50%;
          transition: transform var(--transition), background var(--transition);
        }
        .toggle--on .toggle__thumb { transform: translateX(20px); background: var(--gold); }

        /* ── Relationship summary ────────────────────────── */
        .rel-summary { display: flex; flex-direction: column; gap: 6px; }
        .rel-summary__item {
          padding: 6px 10px; border-radius: var(--radius-md);
          font-size: 0.82rem;
        }
        .rel-summary__item--ally { background: rgba(39,174,96,0.1); }
        .rel-summary__item--enemy { background: rgba(192,57,43,0.1); }
        .rel-summary__names { color: var(--text-secondary); }
        .rel-summary__names strong { font-weight: 700; }

        /* ── Relationship modal ──────────────────────────── */
        .modal-backdrop {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 640px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
        }
        .modal__header { margin-bottom: 20px; }
        .modal__title { font-family: 'Cinzel', serif; font-size: 1.2rem; color: var(--gold); margin-bottom: 6px; }
        .modal__subtitle { font-size: 0.85rem; color: var(--text-muted); }
        .modal__body { margin-bottom: 20px; }
        .modal__footer { display: flex; justify-content: flex-end; gap: 10px; }

        .rel-grid { display: flex; flex-direction: column; gap: 8px; }
        .rel-row { display: flex; align-items: center; gap: 10px; }
        .rel-row__name { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); min-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rel-row__connections { display: flex; flex-wrap: wrap; gap: 6px; }
        .rel-chip {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--bg-elevated); border: 1px solid var(--border);
          font-size: 0.8rem; cursor: pointer;
          transition: all var(--transition);
        }
        .rel-chip:hover { border-color: var(--gold-dim); transform: scale(1.1); }
        .rel-chip--ally { background: rgba(39,174,96,0.2); border-color: #27ae60; color: #2ecc71; }
        .rel-chip--enemy { background: rgba(192,57,43,0.2); border-color: var(--crimson); color: #e05040; }
        .rel-legend { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
        .rel-legend__item { font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }

        /* ── Event card ─────────────────────────────────── */
        .event-card {
          padding: 16px 18px; margin-bottom: 10px;
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); border-left: 3px solid var(--border);
          transition: border-color var(--transition);
        }
        .event-card:hover { border-color: var(--gold-dim); }
        .event-card--fatal { border-left-color: var(--crimson); }
        .event-card__header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .event-card__icon { font-size: 0.9rem; }
        .event-card__stage { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .event-card__stage--bloodbath { color: var(--crimson); }
        .event-card__stage--day { color: var(--gold); }
        .event-card__stage--night { color: #5dade2; }
        .event-card__stage--feast { color: #9b59b6; }
        .event-card__deaths { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
        .event-card__death-name { font-size: 0.72rem; font-weight: 700; color: var(--crimson); }
        .event-card__message { font-size: 0.95rem; color: var(--text-primary); line-height: 1.5; margin-bottom: 10px; }
        .event-card__footer { display: flex; flex-wrap: wrap; gap: 6px; }

        /* ── Results panel ──────────────────────────────── */
        .results-panel { display: flex; flex-direction: column; gap: 24px; }

        .winner-banner {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 40px;
          background: linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%);
          border-color: var(--gold);
          animation: pulse-gold 2s ease-in-out 3;
        }
        .winner-banner__crown { font-size: 3rem; margin-bottom: 8px; filter: drop-shadow(0 0 12px rgba(201,168,76,0.6)); }
        .winner-banner__label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; }
        .winner-banner__name { font-family: 'Cinzel', serif; font-size: 2rem; color: var(--gold); margin: 8px 0 4px; }
        .winner-banner__pronoun { font-size: 0.85rem; color: var(--text-muted); }

        .results-stats {
          display: flex; align-items: center; justify-content: center; gap: 32px;
          padding: 20px;
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
        }
        .results-stats__item { display: flex; flex-direction: column; align-items: center; }
        .results-stats__value { font-family: 'Cinzel', serif; font-size: 2rem; font-weight: 700; color: var(--gold); }
        .results-stats__value--red { color: var(--crimson); }
        .results-stats__label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
        .results-stats__divider { width: 1px; height: 40px; background: var(--border); }

        .results-standings__title {
          font-family: 'Cinzel', serif; font-size: 1rem; color: var(--gold);
          margin-bottom: 16px; letter-spacing: 0.05em;
        }
        .results-standings__list { display: flex; flex-direction: column; gap: 6px; }
        .results-standings__row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          background: var(--bg-elevated); border-radius: var(--radius-md);
          transition: background var(--transition);
        }
        .results-standings__row:hover { background: var(--bg-card); }
        .results-standings__row--dead { opacity: 0.55; }
        .results-standings__rank { font-size: 0.85rem; font-weight: 700; color: var(--gold); min-width: 28px; }
        .results-standings__info { flex: 1; display: flex; flex-direction: column; }
        .results-standings__name { font-weight: 600; font-size: 0.9rem; }
        .results-standings__detail { font-size: 0.75rem; color: var(--text-muted); }
        .results-standings__kills { font-size: 0.82rem; color: var(--gold-dim); font-weight: 600; }

        .results-log__title {
          font-family: 'Cinzel', serif; font-size: 1rem; color: var(--gold);
          margin-bottom: 16px; letter-spacing: 0.05em;
        }
        .results-log__round { margin-bottom: 28px; }
        .results-log__round-header {
          display: flex; align-items: center; justify-content: space-between;
          font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700;
          color: var(--gold); letter-spacing: 0.06em;
          padding-bottom: 10px; margin-bottom: 10px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .results-log__round-survivors { font-size: 0.72rem; color: var(--text-muted); font-weight: 400; }

        .results-actions { display: flex; justify-content: center; padding: 16px 0; }

        /* ── Error banner ───────────────────────────────── */
        .error-banner {
          margin-top: 12px; padding: 12px 16px;
          background: rgba(192,57,43,0.12); border: 1px solid rgba(192,57,43,0.3);
          border-radius: var(--radius-md); color: #e05040; font-size: 0.88rem;
        }

        /* ── Run button ──────────────────────────────────── */
        .run-btn {
          width: 100%; margin-top: 16px;
          padding: 14px; font-size: 1rem; font-weight: 700;
          letter-spacing: 0.05em;
        }
        .run-btn--loading { animation: pulse-gold 1s infinite; }
        .run-btn__spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: var(--bg-void);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .run-btn__hint { text-align: center; font-size: 0.78rem; color: var(--text-muted); margin-top: 6px; }

        /* ── Mobile adjustments ──────────────────────────── */
        @media (max-width: 600px) {
          .app-header__stats { display: none; }
          .add-tribute-form__grid { grid-template-columns: 1fr; }
          .tribute-grid { grid-template-columns: 1fr; }
          .results-stats { gap: 16px; }
          .results-stats__value { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
