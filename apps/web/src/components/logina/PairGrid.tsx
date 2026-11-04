import type { TeacherLogicReviewDTO } from '@logina/contracts';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { optionLetter, plainTeacherText, promptName } from '@/lib/prompt-name';

const RELATION_CLASS: Record<string, string> = { FULL: 'full', PARTIAL: 'part', CONTRADICTS: 'contra', IRRELEVANT: 'none' };

export function PairGrid({ pairs }: { pairs: TeacherLogicReviewDTO['pairs'] }) {
  const { t } = useTranslation();
  const answers = [...new Set(pairs.map((p) => p.answerId))];
  const evidence = [...new Set(pairs.map((p) => p.evidenceId))];
  return (
    <div className="tbl-wrap">
      <div className="pairs">
        <div className="hd">{t('teacher.pairs.corner')}</div>
        {evidence.map((id) => (
          <div key={id} className="hd">{optionLetter(id)}</div>
        ))}
        {answers.map((answerId, row) => (
          <Fragment key={answerId}>
            <div className={`hd ${row === answers.length - 1 ? 'last' : ''}`}>{optionLetter(answerId)}</div>
            {evidence.map((evidenceId) => {
              const pair = pairs.find((p) => p.answerId === answerId && p.evidenceId === evidenceId);
              return (
                <div key={evidenceId} className={row === answers.length - 1 ? 'last' : ''}>
                  <span className={`rel ${RELATION_CLASS[pair?.relationLabel ?? ''] ?? 'none'}`}>{pair?.relationLabel ? plainTeacherText(pair.relationLabel, t) : null}</span>
                  <span className="s13">{pair?.explanation ? plainTeacherText(pair.explanation, t) : null}</span>
                  <span className="goes">{pair?.goesTo ? promptName(pair.goesTo, t) : null}</span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
