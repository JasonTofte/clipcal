'use client';

import { useState } from 'react';

type ExtractState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; message: string };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ExtractState>({ status: 'idle' });

  async function handleExtract() {
    if (!file) return;
    setState({ status: 'loading' });
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setState({
          status: 'error',
          message: json?.error ?? `HTTP ${response.status}`,
        });
        return;
      }
      setState({ status: 'success', data: json });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'network error',
      });
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="mb-6 text-2xl font-semibold">ClipCal — Session 1 feasibility gate</h1>

      <div className="flex flex-col gap-4">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block"
        />

        <button
          type="button"
          onClick={handleExtract}
          disabled={!file || state.status === 'loading'}
          className="w-fit rounded-md bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {state.status === 'loading' ? 'Extracting…' : 'Extract events'}
        </button>

        {state.status === 'error' && (
          <p className="text-sm text-red-600">error: {state.message}</p>
        )}

        {state.status === 'success' && (
          <pre className="overflow-auto rounded-md bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
            {JSON.stringify(state.data, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
