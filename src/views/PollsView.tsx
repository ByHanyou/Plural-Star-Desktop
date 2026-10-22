import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberPoll, fmtTime, fmtPercent, fmtList } from '../utils';
import { saveData } from '../store/actions';
import { Btn, Section, Field, Modal, ConfirmDialog, EmptyState, SaveErrorDialog, linkButton } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useSaveGuard } from '../hooks/useSaveGuard';
import { memberFacetPools } from '../picker/memberPicker';
import { MemberGroupSelect } from '../components/MemberGroupSelect';
import { castPollVote, createPoll, defaultVoterId, pollDraftReady, pollOptionPercent, pollVoterCount, togglePollClosed } from '../polls/polls';
import { tint } from '../theme';

const livePolls = () => useAppStore.getState().polls;

export default function PollsView() {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const front = useAppStore(s => s.front);
  const polls = useAppStore(s => s.polls);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [hideVoters, setHideVoters] = useState(false);
  const [multiChoice, setMultiChoice] = useState(false);
  const [targetId, setTargetId] = useState<string>(() => defaultVoterId(members, front));
  const [voterId, setVoterId] = useState<string>(() => defaultVoterId(members, front));
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saveError, run, clearSaveError] = useSaveGuard();
  const voterPools = memberFacetPools(members, t);

  const savePolls = (updated: MemberPoll[]) => run(() => saveData('polls', updated));
  const updatePoll = (pollId: string, fn: (p: MemberPoll) => MemberPoll) => savePolls(livePolls().map(p => (p.id === pollId ? fn(p) : p)));

  const addPoll = async () => {
    const poll = createPoll({ question, options, targetId, createdBy: voterId, hideVoters, multiChoice });
    if (!poll || !(await savePolls([...livePolls(), poll]))) return;
    setShowCreate(false); setQuestion(''); setOptions(['', '']); setHideVoters(false); setMultiChoice(false);
  };

  const vote = (pollId: string, optionId: string) => {
    if (voterId) void updatePoll(pollId, p => castPollVote(p, optionId, voterId));
  };

  const deletePoll = (id: string) => {
    void savePolls(livePolls().filter(p => p.id !== id));
    setConfirmDelete(null);
  };

  const getName = (id: string) => members.find(m => m.id === id)?.name || '?';

  const checkOption = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 10 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span style={{ fontSize: 13, color: 'var(--dim)' }}>{label}</span>
    </label>
  );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{t('polls.votingAs')}</span>
        <MemberGroupSelect label={t('polls.votingAs')} value={voterId} onChange={setVoterId} pools={voterPools} />
        <div style={{ marginLeft: 'auto' }}>
          <Btn variant="solid" onClick={() => setShowCreate(true)}>{t('polls.createPoll')}</Btn>
        </div>
      </div>

      {polls.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {polls.map(poll => {
            const voterCount = pollVoterCount(poll);
            const isClosed = !!poll.closedAt;
            return (
              <div key={poll.id} style={{ padding: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{poll.question}</span>
                  {isClosed && <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase' }}>{t('polls.closed')}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                  {poll.hideVoterNames ? '' : `${t('noteboard.by', { name: getName(poll.createdBy) })} · `}{fmtTime(poll.createdAt)} · {t('polls.votes', { count: voterCount })}{poll.multipleChoice ? ` · ${t('polls.multipleChoice')}` : ''}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {poll.options.map(opt => {
                    const pct = pollOptionPercent(opt.votes.length, voterCount);
                    const voted = opt.votes.includes(voterId);
                    return (
                      <button key={opt.id} style={{
                        position: 'relative', padding: '10px 14px', borderRadius: 8,
                        border: `1px solid ${voted ? 'var(--accent)' : 'var(--border)'}`,
                        background: 'var(--surface)', cursor: isClosed ? 'default' : 'pointer',
                        textAlign: 'left', overflow: 'hidden',
                      }}
                        onClick={() => vote(poll.id, opt.id)}
                        role={poll.multipleChoice ? 'checkbox' : undefined}
                        aria-checked={poll.multipleChoice ? voted : undefined}
                        aria-pressed={poll.multipleChoice ? undefined : voted}
                        disabled={isClosed}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${pct}%`,
                          background: voted ? tint('var(--accent)', 35) : tint('var(--muted)', 28),
                          transition: 'width 0.3s ease',
                        }} />
                        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: voted ? 'var(--accent)' : 'var(--text)', fontWeight: voted ? 600 : 400 }}>{opt.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtPercent(pct / 100, 0)}</span>
                        </div>
                        {!poll.hideVoterNames && opt.votes.length > 0 && (
                          <div style={{ position: 'relative', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                            {fmtList(opt.votes.map(getName))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={linkButton('var(--accent)')}
                    aria-label={isClosed ? t('polls.reopenPollNamed', { question: poll.question }) : t('polls.closePollNamed', { question: poll.question })}
                    onClick={() => void updatePoll(poll.id, togglePollClosed)}>
                    {isClosed ? t('polls.reopenPoll') : t('polls.closePoll')}
                  </button>
                  <button style={linkButton('var(--danger)')}
                    aria-label={t('common.deleteNamed', { name: poll.question })}
                    onClick={() => setConfirmDelete(poll.id)}>
                    {t('polls.deletePoll')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState>{t('polls.noPolls')}</EmptyState>
      )}

      <Modal open={showCreate} title={t('polls.createPoll')} onClose={() => setShowCreate(false)}
        footer={<Btn variant="solid" disabled={!pollDraftReady({ question, options })} onClick={() => void addPoll()}>{t('common.add')}</Btn>}>
        <div style={{ marginBottom: 12 }}>
          <label className="field__label">{t('polls.forMember')}</label>
          <MemberGroupSelect label={t('polls.forMember')} value={targetId} onChange={setTargetId} pools={voterPools} style={{ width: '100%', padding: '9px 10px', fontSize: 13 }} />
        </div>
        <Field label={t('polls.question')} value={question} onChange={setQuestion} placeholder={t('polls.questionPlaceholder')} />
        <Section label={t('polls.optionsLabel')} />
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="field__input" value={opt} onChange={e => { const u = [...options]; u[i] = e.target.value; setOptions(u); }}
              aria-label={t('polls.optionN', { n: i + 1 })} placeholder={t('polls.optionN', { n: i + 1 })} style={{ flex: 1 }} />
            {options.length > 2 && (
              <button aria-label={t('polls.removeOptionN', { n: i + 1 })} style={linkButton('var(--danger)', 14)}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        <button style={{ ...linkButton('var(--accent)', 12), padding: '6px 0' }}
          onClick={() => setOptions([...options, ''])}>{t('polls.addOption')}</button>
        {checkOption(multiChoice, setMultiChoice, t('polls.multipleChoice'))}
        {checkOption(hideVoters, setHideVoters, t('polls.hideVoters'))}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title={t('polls.deletePoll')} message={t('polls.deletePollMsg')}
        danger onConfirm={() => confirmDelete && deletePoll(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      <SaveErrorDialog error={saveError} onClose={clearSaveError} />
    </div>
  );
}
