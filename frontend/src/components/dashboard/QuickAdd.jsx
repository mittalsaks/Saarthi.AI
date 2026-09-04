import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const MAX_RECORD_SECONDS = 20;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // keep in sync with backend MAX_IMAGE_BYTES
// Preferred order of MediaRecorder mime types - browsers vary in what
// they support, so we probe down this list and use whatever sticks.
const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return ''; // let the browser pick its own default
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

// Voice: 'idle' -> 'recording' -> 'review-audio' -> 'transcribing' -> 'review-entry' -> 'saving'
// Image: 'idle' -> 'review-image' -> 'processing' -> 'review-entry' -> 'saving'
export default function QuickAdd({ onAdded, onFallbackToManual }) {
  const { t } = useTranslation();
  const EXAMPLES = [
    t('dashboard.quickAdd.example1'),
    t('dashboard.quickAdd.example2'),
    t('dashboard.quickAdd.example3'),
  ];

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [voiceStage, setVoiceStage] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [draft, setDraft] = useState(null); // { transcript, entry }

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef('');
  const timerRef = useRef(null);
  const audioBlobRef = useRef(null);

  // ---- Image quick-add state ----
  const [imageStage, setImageStage] = useState('idle');
  const [imageError, setImageError] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageDraft, setImageDraft] = useState(null); // { readText, entry }
  const imageInputRef = useRef(null);
  const imageFileRef = useRef(null);

  useEffect(() => {
    // Stop any live mic stream + release object URLs if the
    // component unmounts mid-recording/review.
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetVoiceFlow() {
    stopTimer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    audioBlobRef.current = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setDraft(null);
    setElapsedSeconds(0);
    setVoiceStage('idle');
  }

  function resetImageFlow() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl('');
    imageFileRef.current = null;
    setImageDraft(null);
    setImageStage('idle');
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handleMicClick() {
    setVoiceError('');
    setError('');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setVoiceError(t('dashboard.quickAdd.micPermissionDenied'));
      } else if (err?.name === 'NotFoundError') {
        setVoiceError(t('dashboard.quickAdd.micNotFound'));
      } else {
        setVoiceError(t('dashboard.quickAdd.micGenericError'));
      }
      return;
    }

    streamRef.current = stream;
    const mimeType = pickSupportedMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setVoiceError(t('dashboard.quickAdd.recordingUnsupported'));
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const finalMimeType = mimeTypeRef.current || recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: finalMimeType });
      audioBlobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
      setVoiceStage('review-audio');
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setVoiceStage('recording');
    setElapsedSeconds(0);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_RECORD_SECONDS) {
          stopTimer();
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
        return next;
      });
    }, 1000);
  }

  function handleStopRecording() {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleCancelRecording() {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Discard - don't keep the onstop-produced blob.
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    resetVoiceFlow();
  }

  function handleReRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    audioBlobRef.current = null;
    setDraft(null);
    setVoiceStage('idle');
  }

  async function handleSendRecording() {
    const blob = audioBlobRef.current;
    if (!blob) return;

    if (blob.size > 8 * 1024 * 1024) {
      setVoiceError(t('dashboard.quickAdd.recordingTooLarge'));
      return;
    }

    setVoiceStage('transcribing');
    setVoiceError('');
    try {
      const base64 = await blobToBase64(blob);
      const data = await api.post('/api/entries/quick-add/voice', {
        audio: base64,
        mimeType: blob.type || 'audio/webm',
        durationSeconds: elapsedSeconds,
      });
      setDraft(data);
      setVoiceStage('review-entry');
    } catch (err) {
      if (err.data?.aiUnavailable) {
        setVoiceError(t('dashboard.quickAdd.voiceAiUnavailable'));
        onFallbackToManual?.(err.data?.transcript || '');
        resetVoiceFlow();
      } else {
        setVoiceError(err.message || t('dashboard.quickAdd.voiceGenericError'));
        setVoiceStage('review-audio');
      }
    }
  }

  async function handleConfirmVoiceEntry() {
    if (!draft?.entry) return;
    setVoiceStage('saving');
    setVoiceError('');
    try {
      const { entry } = await api.post('/api/entries', draft.entry);
      onAdded(entry);
      resetVoiceFlow();
    } catch (err) {
      setVoiceError(err.message || t('dashboard.quickAdd.voiceSaveError'));
      setVoiceStage('review-entry');
    }
  }

  // ---- Image quick-add handlers ----
  function handlePhotoButtonClick() {
    setImageError('');
    setError('');
    if (imageInputRef.current) {
      imageInputRef.current.click();
    } else {
      setImageError(t('dashboard.quickAdd.imageUnsupported'));
    }
  }

  function handleImageFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      setImageError(t('dashboard.quickAdd.imageUnsupported'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t('dashboard.quickAdd.imageTooLarge'));
      return;
    }

    imageFileRef.current = file;
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageStage('review-image');
  }

  function handleRetakePhoto() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl('');
    imageFileRef.current = null;
    setImageDraft(null);
    setImageStage('idle');
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handleSendImage() {
    const file = imageFileRef.current;
    if (!file) return;

    setImageStage('processing');
    setImageError('');
    try {
      const base64 = await blobToBase64(file);
      const data = await api.post('/api/entries/quick-add/image', {
        image: base64,
        mimeType: file.type || 'image/jpeg',
      });
      setImageDraft(data);
      setImageStage('review-entry');
    } catch (err) {
      if (err.data?.aiUnavailable) {
        setImageError(t('dashboard.quickAdd.imageAiUnavailable'));
        onFallbackToManual?.(err.data?.readText || '');
        resetImageFlow();
      } else {
        setImageError(err.message || t('dashboard.quickAdd.imageGenericError'));
        setImageStage('review-image');
      }
    }
  }

  async function handleConfirmImageEntry() {
    if (!imageDraft?.entry) return;
    setImageStage('saving');
    setImageError('');
    try {
      const { entry } = await api.post('/api/entries', imageDraft.entry);
      onAdded(entry);
      resetImageFlow();
    } catch (err) {
      setImageError(err.message || t('dashboard.quickAdd.imageSaveError'));
      setImageStage('review-entry');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { entry } = await api.post('/api/entries/quick-add', { text: text.trim() });
      onAdded(entry);
      setText('');
    } catch (err) {
      if (err.data?.aiUnavailable) {
        setError(t('dashboard.quickAdd.textAiUnavailable'));
        onFallbackToManual?.(text.trim());
      } else {
        setError(err.message || t('dashboard.quickAdd.textGenericError'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showTextForm = voiceStage === 'idle' && imageStage === 'idle';

  return (
    <div className="entry-well p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 flex-none animate-pulse-glow items-center justify-center rounded-xl bg-cta-gradient text-white shadow-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4.5 w-4.5">
            <path d="M12 3l1.9 4.7L19 9l-4.6 2.3L13 16l-1-4.7L7 9l5-1.3L12 3z" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{t('dashboard.quickAdd.title')}</h3>
          <p className="text-xs text-muted">{t('dashboard.quickAdd.subtitle')}</p>
        </div>
      </div>

      {/* Hidden file input reused for the photo button below - `capture="environment"`
          nudges mobile browsers to open the camera directly, while still allowing
          "choose from gallery" on most devices. */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {showTextForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[0]}
            maxLength={500}
            className="flex-1 rounded-lg border border-primary/25 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-muted-light shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="whitespace-nowrap rounded-lg bg-cta-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('dashboard.quickAdd.submitting') : t('dashboard.quickAdd.addButton')}
          </button>
          <button
            type="button"
            onClick={handleMicClick}
            title={t('dashboard.quickAdd.micTitle')}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
            {t('dashboard.quickAdd.micLabel')}
          </button>
          <button
            type="button"
            onClick={handlePhotoButtonClick}
            title={t('dashboard.quickAdd.imageTitle')}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {t('dashboard.quickAdd.imageLabel')}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}

      {/* ---- Voice quick-add flow ---- */}
      {voiceStage === 'recording' && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
          </span>
          <p className="flex-1 text-sm font-semibold text-slate-800">
            {t('dashboard.quickAdd.listening')} {elapsedSeconds}s / {MAX_RECORD_SECONDS}s
          </p>
          <button
            type="button"
            onClick={handleStopRecording}
            className="rounded-lg bg-danger px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
          >
            {t('dashboard.quickAdd.stop')}
          </button>
          <button
            type="button"
            onClick={handleCancelRecording}
            className="rounded-lg border border-surface-500 px-3.5 py-2 text-xs font-bold text-muted hover:text-slate-700"
          >
            {t('dashboard.quickAdd.cancel')}
          </button>
        </div>
      )}

      {voiceStage === 'review-audio' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-800">{t('dashboard.quickAdd.reviewRecordingTitle')}</p>
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendRecording}
              className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
            >
              {t('dashboard.quickAdd.send')}
            </button>
            <button
              type="button"
              onClick={handleReRecord}
              className="rounded-lg border border-surface-500 px-4 py-2 text-xs font-bold text-muted hover:text-slate-700"
            >
              {t('dashboard.quickAdd.reRecord')}
            </button>
            <button
              type="button"
              onClick={resetVoiceFlow}
              className="rounded-lg px-4 py-2 text-xs font-bold text-muted hover:text-danger"
            >
              {t('dashboard.quickAdd.cancel')}
            </button>
          </div>
        </div>
      )}

      {voiceStage === 'transcribing' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-slate-800">
          {t('dashboard.quickAdd.transcribing')}
        </div>
      )}

      {voiceStage === 'review-entry' && draft?.entry && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-light">
            {t('dashboard.quickAdd.reviewEntryTitle')}
          </p>
          {draft.transcript && (
            <p className="mb-2 rounded-md bg-white px-3 py-2 text-xs italic text-muted">"{draft.transcript}"</p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="text-muted">{t('dashboard.quickAdd.fieldType')}</span>
            <span className="font-semibold capitalize text-slate-800">{draft.entry.type}</span>
            <span className="text-muted">{t('dashboard.quickAdd.fieldAmount')}</span>
            <span className="font-semibold text-slate-800">₹{draft.entry.amount}</span>
            <span className="text-muted">{t('dashboard.quickAdd.fieldCategory')}</span>
            <span className="font-semibold capitalize text-slate-800">{draft.entry.category}</span>
            {draft.entry.description && (
              <>
                <span className="text-muted">{t('dashboard.quickAdd.fieldNote')}</span>
                <span className="font-semibold text-slate-800">{draft.entry.description}</span>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmVoiceEntry}
              disabled={voiceStage === 'saving'}
              className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {t('dashboard.quickAdd.confirmSave')}
            </button>
            <button
              type="button"
              onClick={handleReRecord}
              className="rounded-lg border border-surface-500 px-4 py-2 text-xs font-bold text-muted hover:text-slate-700"
            >
              {t('dashboard.quickAdd.reRecord')}
            </button>
            <button
              type="button"
              onClick={resetVoiceFlow}
              className="rounded-lg px-4 py-2 text-xs font-bold text-muted hover:text-danger"
            >
              {t('dashboard.quickAdd.discard')}
            </button>
          </div>
        </div>
      )}

      {voiceStage === 'saving' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-slate-800">
          {t('dashboard.quickAdd.savingEntry')}
        </div>
      )}

      {voiceError && <p className="mt-2 text-xs font-medium text-danger">{voiceError}</p>}

      {/* ---- Image quick-add flow ---- */}
      {imageStage === 'review-image' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-800">{t('dashboard.quickAdd.reviewImageTitle')}</p>
          {imagePreviewUrl && (
            <img src={imagePreviewUrl} alt="" className="max-h-64 w-full rounded-md object-contain" />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendImage}
              className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90"
            >
              {t('dashboard.quickAdd.send')}
            </button>
            <button
              type="button"
              onClick={handleRetakePhoto}
              className="rounded-lg border border-surface-500 px-4 py-2 text-xs font-bold text-muted hover:text-slate-700"
            >
              {t('dashboard.quickAdd.retakePhoto')}
            </button>
            <button
              type="button"
              onClick={resetImageFlow}
              className="rounded-lg px-4 py-2 text-xs font-bold text-muted hover:text-danger"
            >
              {t('dashboard.quickAdd.cancel')}
            </button>
          </div>
        </div>
      )}

      {imageStage === 'processing' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-slate-800">
          {t('dashboard.quickAdd.understandingImage')}
        </div>
      )}

      {imageStage === 'review-entry' && imageDraft?.entry && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-light">
            {t('dashboard.quickAdd.reviewEntryTitle')}
          </p>
          {imageDraft.readText && (
            <p className="mb-2 rounded-md bg-white px-3 py-2 text-xs italic text-muted">"{imageDraft.readText}"</p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="text-muted">{t('dashboard.quickAdd.fieldType')}</span>
            <span className="font-semibold capitalize text-slate-800">{imageDraft.entry.type}</span>
            <span className="text-muted">{t('dashboard.quickAdd.fieldAmount')}</span>
            <span className="font-semibold text-slate-800">₹{imageDraft.entry.amount}</span>
            <span className="text-muted">{t('dashboard.quickAdd.fieldCategory')}</span>
            <span className="font-semibold capitalize text-slate-800">{imageDraft.entry.category}</span>
            {imageDraft.entry.description && (
              <>
                <span className="text-muted">{t('dashboard.quickAdd.fieldNote')}</span>
                <span className="font-semibold text-slate-800">{imageDraft.entry.description}</span>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmImageEntry}
              disabled={imageStage === 'saving'}
              className="rounded-lg bg-cta-gradient px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {t('dashboard.quickAdd.confirmSave')}
            </button>
            <button
              type="button"
              onClick={handleRetakePhoto}
              className="rounded-lg border border-surface-500 px-4 py-2 text-xs font-bold text-muted hover:text-slate-700"
            >
              {t('dashboard.quickAdd.retakePhoto')}
            </button>
            <button
              type="button"
              onClick={resetImageFlow}
              className="rounded-lg px-4 py-2 text-xs font-bold text-muted hover:text-danger"
            >
              {t('dashboard.quickAdd.discard')}
            </button>
          </div>
        </div>
      )}

      {imageStage === 'saving' && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-slate-800">
          {t('dashboard.quickAdd.savingEntry')}
        </div>
      )}

      {imageError && <p className="mt-2 text-xs font-medium text-danger">{imageError}</p>}

      {showTextForm && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="rounded-full border border-surface-500 bg-surface-50 px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}