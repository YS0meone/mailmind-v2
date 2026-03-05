"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { autocompleteContacts } from "@/lib/api-client";
import type { Participant } from "@/types/email";

interface RecipientInputProps {
  value: Participant[];
  onChange: (participants: Participant[]) => void;
  placeholder?: string;
  id?: string;
}

export function RecipientInput({
  value,
  onChange,
  placeholder,
  id,
}: RecipientInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Participant[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const selectedEmails = new Set(value.map((p) => p.email.toLowerCase()));

  const fetchSuggestions = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await autocompleteContacts(q);
          const filtered = results.filter(
            (r) => !selectedEmails.has(r.email.toLowerCase())
          );
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
          setActiveIndex(-1);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addParticipant = (p: Participant) => {
    if (!selectedEmails.has(p.email.toLowerCase())) {
      onChange([...value, p]);
    }
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const finalizeRawInput = () => {
    const trimmed = query.replace(/,+$/, "").trim();
    if (trimmed && trimmed.includes("@")) {
      addParticipant({ email: trimmed });
    } else if (trimmed) {
      // Not a valid email — keep the text
    } else {
      setQuery("");
    }
  };

  const removeParticipant = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && activeIndex >= 0 && suggestions[activeIndex]) {
        addParticipant(suggestions[activeIndex]);
      } else {
        finalizeRawInput();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      removeParticipant(value.length - 1);
    } else if (e.key === "," || e.key === "Tab") {
      if (query.trim()) {
        e.preventDefault();
        finalizeRawInput();
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <div
        className="flex min-h-[36px] flex-wrap items-center gap-1 py-1"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((p, i) => (
          <Badge
            key={p.email + i}
            variant="secondary"
            className="gap-0.5 py-0.5 pl-2 pr-1 text-xs"
          >
            {p.name || p.email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeParticipant(i);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="size-2.5" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            fetchSuggestions(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small delay to allow click on suggestion
            setTimeout(() => finalizeRawInput(), 150);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={s.email}
              type="button"
              className={`flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm ${
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                addParticipant(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s.name && (
                <span className="font-medium">{s.name}</span>
              )}
              <span className="text-xs text-muted-foreground">{s.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
