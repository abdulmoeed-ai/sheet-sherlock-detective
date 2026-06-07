import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ComboboxProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  required = false,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <label>
      <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
        {label}
        {required ? <span className="ml-0.5 text-[var(--color-danger)]">*</span> : null}
      </span>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="flex h-10 w-full items-center justify-between rounded-md border px-3 text-[13px] text-left disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "var(--color-border-strong)" }}
          >
            <span className={selected ? "" : "text-[var(--color-text-muted)]"}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search…" className="text-[13px]" />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-[13px] text-[var(--color-text-muted)]">
                No results found.
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="text-[13px]"
                  >
                    <Check
                      className="mr-2 h-4 w-4"
                      style={{ opacity: value === option.value ? 1 : 0 }}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          value={value}
          onChange={() => {}}
          required
          className="sr-only"
        />
      )}
    </label>
  );
}
