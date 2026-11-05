import { useUnsavedText } from '@/lib/unsaved';
import { TaskName } from '@/components/logina/TaskName';
import { alertVariants } from '@/components/ui/alert';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MaterialMimeType } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Note } from '@/components/logina/Note';
import { Stepper } from '@/components/logina/Stepper';
import { ApiError, createLesson, getMe, getUploadUrl, newKey, registerMaterial, startAnalyze } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { qk } from '@/lib/query';
import { SAMPLE_PREFILL } from '@/lib/sample-prefill';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  const { register, handleSubmit, control, setValue, getValues, formState: { errors, isDirty } } = useForm<Form>({
    resolver: zodResolver(Form),
    defaultValues: kept.form ?? { sourceTitle: '', title: '', subject: '', topic: '', objective: '', contentLocale: i18n.language === 'vi' ? 'vi' : 'en' },
  });
  useUnsavedText(isDirty);

  /** The sample fills every field in the material language, so a judge only has to press Analyze. */
  const fillSample = (locale: Form['contentLocale']) => {
    for (const [name, value] of Object.entries(SAMPLE_PREFILL[locale].lesson)) setValue(name as keyof Form, value, { shouldValidate: Boolean(errors[name as keyof Form]) });
  };

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
          <div className={cardVariants()}>
            <h3 className="s15 b">{t('teacher.t01.material')}</h3>
            <div className={cn(alertVariants({ kind: 'info' }), 'flex-col')}>
              <span className="b text-accent-ink">{t('teacher.t01.guide.title')}</span>
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
              <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => fileInput.current?.click()}>{t(analyze.isError ? 'teacher.t01.refusal.chooseAnother' : 'teacher.t01.chooseFile')}</button>
              {sampleAllowed ? (
                <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => {
                  setUseSample(true);
                  fillSample(getValues('contentLocale'));
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
                <p>{t(errorText(analyze.error))}</p>
              </Note>
            ) : null}
            <Field id="sourceTitle" label={`${t('teacher.t01.sourceTitle')} ${t('teacher.t01.required')}`} error={errorOf('sourceTitle')}>
              <Input id="sourceTitle" {...register('sourceTitle')} />
            </Field>
            <Field id="contentLocale" label={t('teacher.t01.language')}>
              <Controller
                control={control}
                name="contentLocale"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => {
                    field.onChange(value);
                    if (useSample) fillSample(value as Form['contentLocale']);
                  }}>
                    <SelectTrigger id="contentLocale" onBlur={field.onBlur}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('common.lang.en')}</SelectItem>
                      <SelectItem value="vi">{t('common.lang.vi')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <p className="hint">{t('teacher.t01.languageHint')}</p>
          </div>
          <div className={cardVariants()}>
            <h3 className="s15 b">{t('teacher.t01.goalTitle')}</h3>
            <Field id="objective" label={`${t('teacher.t01.goal')} ${t('teacher.t01.required')}`} error={errorOf('objective')}>
              <Textarea id="objective" {...register('objective')} />
            </Field>
          </div>
          <div className={cardVariants()}>
            <h3 className="s15 b">{t('teacher.t01.lessonInfo')}</h3>
            <Field id="title" label={`${t('teacher.t01.lessonTitle')} ${t('teacher.t01.required')}`} error={errorOf('title')}>
              <Input id="title" {...register('title')} />
            </Field>
            <Field id="subject" label={`${t('teacher.t01.subject')} ${t('teacher.t01.required')}`} error={errorOf('subject')}>
              <Input id="subject" {...register('subject')} />
            </Field>
            <Field id="topic" label={`${t('teacher.t01.topic')} ${t('teacher.t01.required')}`} error={errorOf('topic')}>
              <Input id="topic" {...register('topic')} />
            </Field>
          </div>
        </div>
        <div className={cn(cardVariants(), 'sticky')}>
          <h3 className="s15 b">{t('teacher.t01.structureTitle')}</h3>
          <ol className="stack">
            {SLOTS.map((slot) => (
              <li key={slot} className="s13"><TaskName slot={slot} /></li>
            ))}
          </ol>
          <p className="small muted">{t('teacher.t01.structureNote')}</p>
          <button type="submit" className={buttonVariants({ block: true })} aria-busy={analyze.isPending} disabled={analyze.isPending || !classId}>{t('teacher.t01.analyze')}</button>
          {classId ? null : <p className="hint">{t(me.isError ? 'errors.generic' : 'common.loading')}</p>}
        </div>
      </div>
    </form>
  );
}
