export type ClassValue = string | number | false | null | undefined

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ")
}
