import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { ValidationResult } from './schema';

export type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type BetaContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;

/** Минимальный интерфейс клиента — чтобы в тестах подменять SDK. */
export interface ClientLike {
  beta: { messages: { create: (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.Messages.BetaMessage> } };
  models?: { retrieve: (id: string) => Promise<unknown> };
}

export class AiError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Клиент для вызова прямо из браузера. `dangerouslyAllowBrowser` заставляет SDK
 * отправлять заголовок `anthropic-dangerous-direct-browser-access: true`.
 * Ключ хранится только локально на устройстве пользователя.
 */
export function createClient(apiKey: string): ClientLike {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });
}

/** Модели, для которых включаем серверный fallback при отказе (`refusal`). */
const SERVER_FALLBACK = /^claude-(sonnet-5-5|opus-5-5|opus-5|fable-5(-[12])?)$/;
/** Модели с поддержкой параметра effort. */
const SUPPORTS_EFFORT = /^claude-(opus|sonnet|haiku|fable|mythos)-[5-9]/;

export function requestExtras(model: string, effort: 'low' | 'medium' | 'high') {
  return {
    ...(SERVER_FALLBACK.test(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    effort: SUPPORTS_EFFORT.test(model) ? effort : undefined,
  };
}

/** Перевод ошибок SDK в понятные сообщения. */
export function describeError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError('неверный API-ключ');
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('у ключа нет доступа к этой модели');
  if (e instanceof Anthropic.NotFoundError) return new AiError('модель не найдена — проверьте ID в настройках');
  if (e instanceof Anthropic.RateLimitError) return new AiError('превышен лимит запросов, попробуйте позже', true);
  if (e instanceof Anthropic.BadRequestError) return new AiError(`запрос отклонён: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AiError('истекло время ожидания ответа', true);
  if (e instanceof Anthropic.APIConnectionError) return new AiError('нет связи с API Anthropic', true);
  if (e instanceof Anthropic.APIError) return new AiError(`ошибка API (${e.status ?? '?'})`, true);
  return new AiError(e instanceof Error ? e.message : String(e));
}

function extractText(msg: Anthropic.Beta.Messages.BetaMessage): string {
  return msg.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Блоки ответа для повторной отправки в историю (thinking передаём без изменений). */
function echoContent(msg: Anthropic.Beta.Messages.BetaMessage): BetaContentBlockParam[] {
  return msg.content.filter((b) => b.type === 'text' || b.type === 'thinking' || b.type === 'redacted_thinking') as BetaContentBlockParam[];
}

export interface StructuredRequest<S extends z.ZodType, T> {
  client: ClientLike;
  model: string;
  effort: 'low' | 'medium' | 'high';
  system: string;
  user: string;
  schema: S;
  validate: (json: unknown) => ValidationResult<T>;
  maxAttempts?: number;
  onAttempt?: (attempt: number, errors?: string[]) => void;
}

/**
 * Запрос со строгим JSON (structured outputs) и смысловой проверкой.
 * При невалидном ответе модели отправляются ошибки, и она повторяет попытку.
 */
export async function requestStructured<S extends z.ZodType, T>(req: StructuredRequest<S, T>): Promise<T> {
  const maxAttempts = req.maxAttempts ?? 3;
  const { betas, fallbacks, effort } = requestExtras(req.model, req.effort);
  const messages: BetaMessageParam[] = [{ role: 'user', content: req.user }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    req.onAttempt?.(attempt, attempt > 1 ? lastErrors : undefined);
    let res: Anthropic.Beta.Messages.BetaMessage;
    try {
      res = await req.client.beta.messages.create({
        model: req.model,
        max_tokens: 16000,
        system: req.system,
        messages: [...messages],
        output_config: { format: betaZodOutputFormat(req.schema), ...(effort ? { effort } : {}) },
        ...(betas ? { betas, fallbacks } : {}),
      });
    } catch (e) {
      throw describeError(e);
    }

    if (res.stop_reason === 'refusal') throw new AiError('модель отказалась отвечать');

    let json: unknown;
    let errors: string[] = [];
    if (res.stop_reason === 'max_tokens') {
      errors = ['ответ обрезан по лимиту токенов — сделай его короче'];
    } else {
      try {
        json = JSON.parse(extractText(res));
      } catch {
        errors = ['ответ не является корректным JSON'];
      }
    }
    if (!errors.length) {
      const v = req.validate(json);
      if (v.ok) return v.value;
      errors = v.errors;
    }
    lastErrors = errors;
    messages.push(
      { role: 'assistant', content: echoContent(res) },
      {
        role: 'user',
        content: `Ответ не прошёл проверку приложения:\n${errors.map((e) => `- ${e}`).join('\n')}\nИсправь эти ошибки и верни полный JSON заново.`,
      },
    );
  }
  throw new AiError(`ИИ вернул некорректный ответ (${maxAttempts} попытки): ${lastErrors.slice(0, 3).join('; ')}`);
}
