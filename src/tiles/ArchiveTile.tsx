import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Tile } from '../components/Tile';

interface Props { onClick: () => void; }

export default function ArchiveTile({ onClick }: Props) {
  const { t } = useTranslation();
  const members = useAppStore(s => s.members);
  const archived = members.filter(m => m.archived && !m.deleted);
  return (
    <Tile glyph="🗃" title={t('hub.archive')} onClick={onClick} center>
      {archived.length === 0 ? (
        <span className="tile__empty">{t('members.noArchived')}</span>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>
          {t('members.archivedCount', { count: archived.length })}
        </span>
      )}
    </Tile>
  );
}
