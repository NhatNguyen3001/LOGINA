import { zodResolver } from '@hookform/resolvers/zod';
import type { MaterialMimeType } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Note } from '@/components/logina/Note';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { ApiError, createLesson, getClass, getMe, getUploadUrl, newKey, registerMaterial, startAnalyze } from '@/lib/api';
import { qk } from '@/lib/query';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const ACCEPT = '.pdf,.docx';

const Form = z.object({
  sourceTitle: z.string().min(1),
  title: z.string().min(1),
  subject: z.string().min(1),
  topic: z.string().min(1),
  objective: z.string().min(1),
  contentLocale: z.enum(['en', 'vi']),
});
type Form = z.infer<typeof Form>;

/** Survives Stop analysis and a refused file, so nothing typed is lost and no second lesson is made. */
const kept: { form: Form | null; lessonId: string | null } = { form: null, lessonId: null };

export const clearKeptLesson = (): void => {
  kept.form = null;
  kept.lessonId = null;
};

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="hint text-red" role="alert">{error}</span> : null}
    </div>
  );
}

export function CreateLesson({ sampleAllowed = import.meta.env.VITE_DEMO_MODE === 'true' }: { sampleAllowed?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [missingMaterial, setMissingMaterial] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const classId = me.data?.classIds[0];
  const classInfo = useQuery({ queryKey: qk.class(classId ?? 'none'), queryFn: () => getClass(classId!), enabled: Boolean(classId) });

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Form),
    defaultValues: kept.form ?? { sourceTitle: '', title: '', subject: '', topic: '', objective: '', contentLocale: i18n.language === 'vi' ? 'vi' : 'en' },
  });

  const analyze = useMutation({
    mutationFn: async (values: Form) => {
      kept.form = values;
      const lessonId = kept.lessonId ?? (await createLesson({ title: values.title, subject: values.subject, topic: values.topic, level: 'basic', primaryClassId: classId!, objective: values.objective, contentLocale: values.contentLocale }, newKey())).id;
      kept.lessonId = lessonId;
      if (useSample) {
        await registerMaterial(lessonId, { sample: true }, newKey());
      } else {
        const { uploadId, url } = await getUploadUrl(lessonId, { fileName: file!.name, contentType: file!.type as MaterialMimeType, sizeBytes: file!.size }, newKey());
        const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file!.type }, body: file });
        if (!put.ok) throw new ApiError(put.status, 'INTERNAL');
        await registerMaterial(lessonId, { uploadId, title: values.sourceTitle }, newKey());
      }
      await startAnalyze(lessonId, newKey());
      return lessonId;
    },
    onSuccess: async (lessonId) => {
      clearKeptLesson();
      await queryClient.invalidateQueries({ queryKey: qk.lessons() });
      await navigate({ to: '/t/lessons/$id/analyze', params: { id: lessonId } });
    },
  });

  const submit = handleSubmit((values) => {
    if (!file && !useSample) {
      setMissingMaterial(true);
      return;
    }
    analyze.mutate(values);
  });

  const errorOf = (name: keyof Form) => (errors[name] ? t('teacher.t01.requiredError') : undefined);
  const code = analyze.error instanceof ApiError ? analyze.error.code : '';

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="contents">
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t01.crumb')}</span>
      </nav>
      <Stepper current={0} />
      <div className="stack">
        <h1 className="h1">{t('teacher.t01.title')}</h1>
        <p className="lede">{t('teacher.t01.lede')}</p>
      </div>
      <div className="cols">
        <div className="stack">
          <div className="card">
            <h3 className="s15 b">{t('teacher.t01.material')}</h3>
            <div className="note info flex-col">
              <span className="b text-navy">{t('teacher.t01.guide.title')}</span>
              <ul className="list-disc pl-5">
                {['pages', 'formats', 'languages', 'content'].map((item) => (
                  <li key={item}>{t(`teacher.t01.guide.${item}`)}</li>
                ))}
              </ul>
            </div>
            <div className="row">
              <input ref={fileInput} type="file" accept={ACCEPT} className="vh" aria-label={t('teacher.t01.chooseFile')} tabIndex={-1} onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setUseSample(false);
                setMissingMaterial(false);
                analyze.reset();
              }} />
              <button type="button" className="btn secondary sm" onClick={() => fileInput.current?.click()}>{t(analyze.isError ? 'teacher.t01.refusal.chooseAnother' : 'teacher.t01.chooseFile')}</button>
              {sampleAllowed ? (
                <button type="button" className="btn secondary sm" onClick={() => {
                  setUseSample(true);
                  setFile(null);
                  setMissingMaterial(false);
                  analyze.reset();
                }}>{t('teacher.t01.useSample')}</button>
              ) : null}
              <span className="small muted">{t('teacher.t01.fileHint')}</span>
            </div>
            {file ? <p className="s13 m">{file.name}</p> : null}
            {useSample ? <p className="s13 m">{t('teacher.t01.sampleChosen')}</p> : null}
            {missingMaterial ? <Note kind="err">{t('teacher.t01.noMaterial')}</Note> : null}
            {analyze.isError ? (
              <Note kind="err">
                <span className="b">{t('teacher.t01.refusal.title')}</span>
                <p>{t(errorKey(code))}</p>
              </Note>
            ) : null}
            <Field id="sourceTitle" label={`${t('teacher.t01.sourceTitle')} ${t('teacher.t01.required')}`} error={errorOf('sourceTitle')}>
              <input id="sourceTitle" className="input" {...register('sourceTitle')} />
            </Field>
            <Field id="contentLocale" label={t('teacher.t01.language')}>
              <select id="contentLocale" className="select" {...register('contentLocale')}>
                <option value="en">{t('common.lang.en')}</option>
                <option value="vi">{t('common.lang.vi')}</option>
              </select>
            </Field>
            <p className="hint">{t('teacher.t01.languageHint')}</p>
          </div>
          <div className="card">
            <h3 className="s15 b">{t('teacher.t01.goalTitle')}</h3>
            <Field id="objective" label={`${t('teacher.t01.goal')} ${t('teacher.t01.required')}`} error={errorOf('objective')}>
              <textarea id="objective" className="textarea" {...register('objective')} />
            </Field>
          </div>
          <div className="card">
            <h3 className="s15 b">{t('teacher.t01.lessonInfo')}</h3>
            <Field id="title" label={`${t('teacher.t01.lessonTitle')} ${t('teacher.t01.required')}`} error={errorOf('title')}>
              <input id="title" className="input" {...register('title')} />
            </Field>
            <Field id="subject" label={`${t('teacher.t01.subject')} ${t('teacher.t01.required')}`} error={errorOf('subject')}>
              <input id="subject" className="input" {...register('subject')} />
            </Field>
            <Field id="topic" label={`${t('teacher.t01.topic')} ${t('teacher.t01.required')}`} error={errorOf('topic')}>
              <input id="topic" className="input" {...register('topic')} />
            </Field>
          </div>
        </div>
        <div className="card sticky">
          <div className="row">
            <span className="s13 muted">{t('teacher.t01.class')}</span>
            <span className="b">{classInfo.data?.name ?? t('common.loading')}</span>
          </div>
          <h3 className="s15 b">{t('teacher.t01.structureTitle')}</h3>
          <ol className="stack">
            {SLOTS.map((slot) => (
              <li key={slot} className="s13">{t(`teacher.taskType.${slot}`)}</li>
            ))}
          </ol>
          <p className="small muted">{t('teacher.t01.structureNote')}</p>
          <button type="submit" className="btn primary block" disabled={analyze.isPending || !classId}>{t('teacher.t01.analyze')}</button>
          {classId ? null : <p className="hint">{t(me.isError ? 'errors.generic' : 'common.loading')}</p>}
        </div>
      </div>
    </form>
  );
}
