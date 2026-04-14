'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { InterestPicker } from '@/components/interest-picker';
import { CalmModeToggle } from '@/components/calm-mode-toggle';
import { Button } from '@/components/ui/button';
import { GoldyBubble } from '@/components/shared';
import { ProfileSchema, loadProfileFromStorage, saveProfileToStorage } from '@/lib/profile';
import { cn } from '@/lib/utils';

type ProfileMode = 'pick' | 'chat';

const MIN_USER_MESSAGES_BEFORE_DONE = 3;

type ExtractState =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'error'; message: string }
  | { status: 'saved' };

export default function ProfilePage() {
  const router = useRouter();
  const [mode, setMode] = useState<ProfileMode>('pick');
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState('');
  const [extractState, setExtractState] = useState<ExtractState>({ status: 'idle' });

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const canFinish = userMessageCount >= MIN_USER_MESSAGES_BEFORE_DONE;
  const busy = status === 'submitted' || status === 'streaming' || extractState.status === 'extracting';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput('');
    await sendMessage({ text: trimmed });
  }

  async function handleFinish() {
    setExtractState({ status: 'extracting' });
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json) {
        const msg =
          json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
            ? json.error
            : `HTTP ${response.status}`;
        setExtractState({ status: 'error', message: msg });
        return;
      }
      const parsed = ProfileSchema.safeParse(json);
      if (!parsed.success) {
        setExtractState({ status: 'error', message: 'profile did not match schema' });
        return;
      }
      // Preserve homeBase across interview-mode saves — the LLM extractor
      // doesn't ask about addresses.
      const existing = loadProfileFromStorage();
      saveProfileToStorage({
        ...parsed.data,
        homeBase: existing?.homeBase ?? null,
      });
      setExtractState({ status: 'saved' });
      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      setExtractState({
        status: 'error',
        message: err instanceof Error ? err.message : 'network error',
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Pick your interests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap what you&rsquo;re into. ClipCal uses this to highlight events that fit you — never
            auto-declines anything. Prefer a chat? Toggle to interview mode below.
          </p>
        </div>
        <CalmModeToggle />
      </header>

      <GoldyBubble avatar tone="gold" className="mb-5 self-start max-w-md">
        <p className="text-sm leading-snug">
          The more I know what you&rsquo;re into, the better I can pick the picks.
        </p>
      </GoldyBubble>

      <div
        role="tablist"
        aria-label="Profile setup mode"
        className="mb-5 flex justify-center gap-10 border-b border-border"
      >
        {(['pick', 'chat'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'relative pb-3 text-sm font-medium transition-colors',
              mode === m ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'pick' ? 'Quick pick' : 'Chat setup'}
            <span
              className="absolute -bottom-px left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-all duration-200"
              style={{
                width: mode === m ? 'calc(100% + 24px)' : '0px',
                background: 'var(--goldy-maroon-500)',
              }}
            />
          </button>
        ))}
      </div>

      {mode === 'pick' ? (
        <InterestPicker />
      ) : (
        <>
          <div className="flex-1 space-y-4">
            {messages.length === 0 && (
              <EmptyPrompt onStart={() => sendMessage({ text: 'hi, ready to start' })} />
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {status === 'submitted' && (
              <div className="text-xs text-muted-foreground italic">thinking…</div>
            )}
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/20">
                Chat error: {error.message}
              </div>
            )}
          </div>

          {extractState.status === 'saved' ? (
            <div className="mt-6 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400">
              Got it. Taking you back to the upload page.
            </div>
          ) : extractState.status === 'error' ? (
            <div className="mt-6 space-y-2">
              <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">
                Couldn&rsquo;t save your profile: {extractState.message}
              </div>
              <Button variant="outline" onClick={handleFinish}>
                Try again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="type a reply…"
                  disabled={busy}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                  aria-label="Your reply"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  Send
                </Button>
              </div>
              {canFinish && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Enough signal to save. You can keep chatting or finish now.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={extractState.status === 'extracting'}
                    onClick={handleFinish}
                  >
                    {extractState.status === 'extracting' ? 'Saving…' : 'Finish & save'}
                  </Button>
                </div>
              )}
            </form>
          )}
        </>
      )}
    </main>
  );
}

function EmptyPrompt({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-5">
      <p className="text-sm">
        Ready when you are. This takes about 90 seconds and lives only on your phone — nothing
        syncs anywhere.
      </p>
      <Button type="button" size="sm" onClick={onStart}>
        Start the interview
      </Button>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('');
  const isUser = message.role === 'user';
  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground ring-1 ring-inset ring-border',
        )}
      >
        {text || <span className="opacity-50 italic">…</span>}
      </div>
    </div>
  );
}
