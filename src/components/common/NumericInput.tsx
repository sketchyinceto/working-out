import React, { useEffect, useRef, useState } from 'react';

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
  /** Allow decimals (weights). Whole numbers only otherwise (reps, sets). */
  decimal?: boolean;
}

function sanitize(raw: string, decimal: boolean): string {
  const cleaned = decimal
    ? raw.replace(/,/g, '.').replace(/[^0-9.]/g, '') // "22,5" -> "22.5"
    : raw.replace(/[^0-9]/g, '');
  return cleaned.replace(/^0+(?=\d)/, '');
}

const display = (value: number) => (value === 0 ? '' : String(value));

/**
 * Text input for numbers that's pleasant on phones: shows the numeric keypad,
 * lets you clear the field or type "22." mid-edit without it snapping back,
 * accepts comma decimals, and reports 0 for an empty field.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  decimal = false,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [raw, setRaw] = useState(() => display(value));
  // The next value change is the echo of what was just typed (possibly
  // rounded, e.g. lb -> kg -> lb), so it must not overwrite the text box.
  const echoPendingRef = useRef(false);

  // Follow changes made elsewhere (e.g. the +2.5 buttons).
  useEffect(() => {
    if (echoPendingRef.current) {
      echoPendingRef.current = false;
      return;
    }
    const parsed = decimal ? parseFloat(raw) : parseInt(raw, 10);
    if ((isNaN(parsed) ? 0 : parsed) !== value) setRaw(display(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // The typing and its echo render together, so by the end of this render
  // the echo (if any) has been handled. Runs after the effect above.
  useEffect(() => {
    echoPendingRef.current = false;
  });

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={raw}
      onFocus={onFocus}
      onBlur={(e) => {
        setRaw(display(value));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const cleaned = sanitize(e.target.value, decimal);
        setRaw(cleaned);
        const parsed = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
        const next = isNaN(parsed) ? 0 : Math.max(0, parsed);
        if (next !== value) echoPendingRef.current = true;
        onValueChange(next);
      }}
    />
  );
};
