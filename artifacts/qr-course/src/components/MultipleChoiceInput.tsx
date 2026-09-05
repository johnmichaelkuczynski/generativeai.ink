import React from "react";
import type { KeystrokeTrace } from "@workspace/api-client-react";

export type MultipleChoiceOption = {
  letter: string;
  text: string;
  value: string;
};

export type ParsedMultipleChoice = {
  stem: string;
  options: MultipleChoiceOption[];
};

export function parseMultipleChoicePrompt(
  prompt: string,
): ParsedMultipleChoice | null {
  const matches = [...prompt.matchAll(/(?:^|\s)([A-D])\)\s*/g)];
  if (matches.length < 2) return null;

  const stem = prompt.slice(0, matches[0].index).trim();
  const options = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length ? (matches[index + 1].index ?? prompt.length) : prompt.length;
    const text = prompt
      .slice(start, end)
      .replace(/\s*Enter the full option\.?\s*$/i, "")
      .trim();
    const letter = match[1];
    return { letter, text, value: `${letter}) ${text}` };
  });

  return options.every((option) => option.text) ? { stem, options } : null;
}

interface MultipleChoiceInputProps {
  options: MultipleChoiceOption[];
  value: string;
  onChange: (value: string, trace: KeystrokeTrace) => void;
  disabled?: boolean;
}

export function MultipleChoiceInput({
  options,
  value,
  onChange,
  disabled,
}: MultipleChoiceInputProps) {
  const choose = (option: MultipleChoiceOption) => {
    onChange(option.value, {
      keystrokeCount: 1,
      eraseCount: 0,
      bulkInsertCount: 0,
      longestBulkInsertChars: 0,
      rewriteSegments: 0,
      durationMs: 0,
    });
  };

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">Select one answer</legend>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.letter}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-input bg-card hover:border-primary/60"
            } ${disabled ? "cursor-default opacity-80" : ""}`}
          >
            <input
              type="radio"
              name="multiple-choice-answer"
              value={option.value}
              checked={selected}
              onChange={() => choose(option)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span className="leading-relaxed">
              <strong className="mr-2">{option.letter}.</strong>
              {option.text}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}