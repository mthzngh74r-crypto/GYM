import { useState } from 'react';
import { Button } from '../../components/ui';
import { useSettings } from '../../hooks/useSettings';

export function ApiKeyCheck() {
  const s = useSettings();
  const [state, setState] = useState<{ busy: boolean; msg?: string; ok?: boolean }>({ busy: false });
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={!s.apiKey || state.busy}
        onClick={async () => {
          setState({ busy: true });
          try {
            const { checkApiKey } = await import('../../ai/generate');
            setState({ busy: false, ok: true, msg: await checkApiKey(s) });
          } catch (e) {
            setState({ busy: false, ok: false, msg: e instanceof Error ? e.message : String(e) });
          }
        }}
      >
        {state.busy ? 'Проверяю…' : 'Проверить ключ'}
      </Button>
      {state.msg && <div className={`text-sm ${state.ok ? 'text-accent' : 'text-danger'}`}>{state.ok ? '✓ ' : '✕ '}{state.msg}</div>}
      <div className="text-xs text-muted">
        Ключ можно получить на console.anthropic.com → API Keys. Запросы идут напрямую из браузера в API Anthropic.
      </div>
    </div>
  );
}
