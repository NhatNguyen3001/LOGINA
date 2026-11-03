import { fireEvent, screen } from '@testing-library/react';
import type { DraftArtifact, StudentTaskDTO } from '@logina/contracts';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ArtifactEditor, describeChange } from '@/features/student/editors';
import { renderWithI18n } from './utils';

/**
 * Guards the research data through the shadcn move: each editor, driven the way a student would,
 * must produce the same answers and the same change labels as before. The snapshots were recorded
 * on the code before any student screen changed; a difference here is a change to the study data.
 */
function Recorder({ task, start, log }: { task: StudentTaskDTO; start: DraftArtifact; log: unknown[] }) {
  const [value, setValue] = useState(start);
  return (
    <ArtifactEditor
      task={task}
      value={value}
      onChange={(next) => {
        log.push({ next, change: describeChange(task, value, next) });
        setValue(next);
      }}
    />
  );
}

const run = async (task: StudentTaskDTO, start: DraftArtifact, drive: () => void) => {
  const log: unknown[] = [];
  await renderWithI18n(<Recorder task={task} start={start} log={log} />);
  drive();
  return log;
};

describe('research data guard', () => {
  it('Q1 records the statement and card letters', async () => {
    const task = { slot: 'Q1', answers: [{ id: 'a1', text: 'First statement' }, { id: 'a2', text: 'Second statement' }], evidence: [{ id: 'e1', text: 'Card one' }, { id: 'e2', text: 'Card two' }] } as unknown as StudentTaskDTO;
    const log = await run(task, { slot: 'Q1' }, () => {
      fireEvent.click(screen.getByRole('radio', { name: /First statement/ }));
      fireEvent.click(screen.getByRole('radio', { name: /Second statement/ }));
      fireEvent.click(screen.getByRole('radio', { name: /Card two/ }));
    });
    expect(log).toMatchInlineSnapshot(`
      [
        {
          "change": [
            "A",
          ],
          "next": {
            "answerId": "a1",
            "slot": "Q1",
          },
        },
        {
          "change": [
            "B",
          ],
          "next": {
            "answerId": "a2",
            "slot": "Q1",
          },
        },
        {
          "change": [
            "Card B",
          ],
          "next": {
            "answerId": "a2",
            "evidenceId": "e2",
            "slot": "Q1",
          },
        },
      ]
    `);
  });

  it('Q2 records the order after a button move', async () => {
    const task = { slot: 'Q2', taskBody: { cards: [{ cardId: 'k1', text: 'One' }, { cardId: 'k2', text: 'Two' }, { cardId: 'k3', text: 'Three' }], basis: 'b' } } as unknown as StudentTaskDTO;
    const log = await run(task, { slot: 'Q2', orderedCardIds: ['k1', 'k2', 'k3'] }, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move Three up' }));
      fireEvent.click(screen.getByRole('button', { name: 'Move One down' }));
    });
    expect(log).toMatchInlineSnapshot(`
      [
        {
          "change": [
            "order=k1>k3>k2",
          ],
          "next": {
            "orderedCardIds": [
              "k1",
              "k3",
              "k2",
            ],
            "slot": "Q2",
          },
        },
        {
          "change": [
            "order=k3>k1>k2",
          ],
          "next": {
            "orderedCardIds": [
              "k3",
              "k1",
              "k2",
            ],
            "slot": "Q2",
          },
        },
      ]
    `);
  });

  it('Q3 records the path, the cost and the reason', async () => {
    const task = {
      slot: 'Q3',
      taskBody: {
        options: [{ optionId: 'o1', text: 'Plan A' }, { optionId: 'o2', text: 'Plan B' }],
        tradeOffs: [
          { tradeOffId: 't1', optionId: 'o1', text: 'Slower', reasons: [{ reasonId: 'r1', text: 'It needs more steps' }] },
          { tradeOffId: 't2', optionId: 'o2', text: 'Dearer', reasons: [{ reasonId: 'r3', text: 'It uses more staff' }] },
        ],
      },
    } as unknown as StudentTaskDTO;
    const log = await run(task, { slot: 'Q3' }, () => {
      fireEvent.click(screen.getByRole('radio', { name: /Plan A/ }));
      fireEvent.click(screen.getByRole('radio', { name: 'Slower' }));
      fireEvent.click(screen.getByRole('radio', { name: 'It needs more steps' }));
      fireEvent.click(screen.getByRole('radio', { name: /Plan B/ }));
    });
    expect(log).toMatchInlineSnapshot(`
      [
        {
          "change": [
            "path=o1",
          ],
          "next": {
            "judgmentOptionId": "o1",
            "slot": "Q3",
          },
        },
        {
          "change": [
            "cost=t1",
          ],
          "next": {
            "judgmentOptionId": "o1",
            "slot": "Q3",
            "tradeOffId": "t1",
          },
        },
        {
          "change": [
            "reason=r1",
          ],
          "next": {
            "judgmentOptionId": "o1",
            "reasonId": "r1",
            "slot": "Q3",
            "tradeOffId": "t1",
          },
        },
        {
          "change": [
            "path=o2",
          ],
          "next": {
            "judgmentOptionId": "o2",
            "slot": "Q3",
          },
        },
      ]
    `);
  });

  it('Q4 records each card placed in a blank', async () => {
    const task = {
      slot: 'Q4',
      taskBody: { frame: 'The source shows [shown], but not [missing].', slots: [{ slotId: 'shown', label: 'Shows' }, { slotId: 'missing', label: 'Gap' }], cards: [{ cardId: 'c1', text: 'a fall' }, { cardId: 'c2', text: 'why' }, { cardId: 'c3', text: 'a rise' }] },
    } as unknown as StudentTaskDTO;
    const log = await run(task, { slot: 'Q4', placements: [] }, () => {
      fireEvent.click(screen.getByRole('button', { name: 'a fall' }));
      fireEvent.click(screen.getAllByRole('button', { description: 'Shows' })[0]!);
      fireEvent.click(screen.getByRole('button', { name: 'why' }));
      fireEvent.click(screen.getAllByRole('button', { description: 'Gap' })[0]!);
    });
    expect(log).toMatchInlineSnapshot(`
      [
        {
          "change": [
            "shown=c1",
          ],
          "next": {
            "placements": [
              {
                "cardId": "c1",
                "slotId": "shown",
              },
            ],
            "slot": "Q4",
          },
        },
        {
          "change": [
            "missing=c2",
          ],
          "next": {
            "placements": [
              {
                "cardId": "c1",
                "slotId": "shown",
              },
              {
                "cardId": "c2",
                "slotId": "missing",
              },
            ],
            "slot": "Q4",
          },
        },
      ]
    `);
  });

  it('Q5 records each sentence as typed', async () => {
    const task = { slot: 'Q5', taskBody: { instructions: 'Write.', maxCharsPerField: 120, starters: [{ starterId: 's1', text: 'Jobs depend on...' }, { starterId: 's2', text: 'Staying gives up...' }] } } as unknown as StudentTaskDTO;
    const log = await run(task, { slot: 'Q5', answers: [] }, () => {
      const [first, second] = screen.getAllByRole('textbox');
      fireEvent.change(first!, { target: { value: 'factories nearby' } });
      fireEvent.change(second!, { target: { value: 'family time' } });
    });
    expect(log).toMatchInlineSnapshot(`
      [
        {
          "change": [
            "s1",
          ],
          "next": {
            "answers": [
              {
                "starterId": "s1",
                "text": "factories nearby",
              },
            ],
            "slot": "Q5",
          },
        },
        {
          "change": [
            "s2",
          ],
          "next": {
            "answers": [
              {
                "starterId": "s1",
                "text": "factories nearby",
              },
              {
                "starterId": "s2",
                "text": "family time",
              },
            ],
            "slot": "Q5",
          },
        },
      ]
    `);
  });
});
