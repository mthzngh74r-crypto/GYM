import { useEffect, useState } from 'react';
import { inputCls } from './ui';

/** Числовое поле, которое не мешает вводить «2,» и пустую строку. */
export function NumInput({
  value,
  onChange,
  placeholder,
  className = '',
  step = 'any',
  allowEmpty = true,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
  step?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const parsed = parseNum(text);
    if (parsed !== value) setText(value == null ? '' : String(value).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      className={`${inputCls} tabular ${className}`}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,-]/g, '');
        setText(t);
        const n = parseNum(t);
        if (n !== null || allowEmpty) onChange(n);
      }}
    />
  );
}

export function parseNum(t: string): number | null {
  if (t.trim() === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
