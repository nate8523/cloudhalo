import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize CSV value to prevent CSV Formula Injection
 *
 * Protects against CSV injection attacks by prefixing dangerous characters
 * that could be interpreted as formulas by Excel/LibreOffice/Google Sheets.
 *
 * OWASP Reference: CSV Injection (also known as Formula Injection)
 * Attack Vector: Fields starting with =, +, -, @, tab, or carriage return
 * can execute as formulas when opened in spreadsheet applications.
 *
 * @param value - The value to sanitize (string, number, null, or undefined)
 * @returns Sanitized string safe for CSV export
 *
 * @example
 * sanitizeCsvValue("=1+1") // Returns "'=1+1"
 * sanitizeCsvValue("@SUM(A1:A10)") // Returns "'@SUM(A1:A10)"
 * sanitizeCsvValue("Normal text") // Returns "Normal text"
 * sanitizeCsvValue(null) // Returns ""
 */
export function sanitizeCsvValue(value: string | number | null | undefined): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  const stringValue = String(value);

  // Empty string is safe
  if (stringValue.length === 0) {
    return '';
  }

  // Check first character for dangerous formula starters
  const firstChar = stringValue.charAt(0);
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];

  if (dangerousChars.includes(firstChar)) {
    // Prefix with single quote to prevent formula execution
    // The quote will be visible in the cell but prevents code execution
    return `'${stringValue}`;
  }

  return stringValue;
}
