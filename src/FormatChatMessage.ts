/**
 * @module FormatChatMessage
 * 
 * Utilities for formatting chat messages and timestamps into human-readable text.
 * Provides functions to render chat messages with timestamps and format dates
 * using friendly relative terms like 'Today' and 'Yesterday'.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// Utilities for turning chat messages and their timestamps into readable, user-facing text. The module focuses on producing consistent labels for message originators and friendly date strings that prefer relative terms.
// 
// renderChatMessageAsText takes an IChatMessage and returns a single formatted text block. It chooses “User” or “Assistant” from the message role, formats the message timestamp, and then outputs a bracketed timestamp header followed by the originator label, the message content, and a trailing newline. It always requests the “full date” form for the timestamp.
// 
// formatChatMessageTimestamp formats a Date into “Today”, “Yesterday”, or a long weekday plus day and month, and always appends local time in two-digit hour and minute. When fullDate is true, Today/Yesterday also include the long date in parentheses. The function normalizes input via new Date(...) to tolerate Date-like values.
// 
// It depends on EChatRole and IChatMessage from ./entry to interpret roles and message shape.
// ===End StrongAI Generated Comment===



import { EChatRole, IChatMessage } from "./entry";

const TIMESTAMP_LOCALE = 'en-GB';

/**
 * Creates a text representation of a chat message including originator,
 * content, and timestamp.
 * 
 * @param message The chat message to render
 * @returns Formatted string representation of the message
 */


export function renderChatMessageAsText(message: IChatMessage): string {
   const originator = message.role === EChatRole.kUser ? "User" : "Assistant";
   const timestamp = formatChatMessageTimestamp(new Date(message.timestamp), true);
   
   return `[${timestamp}] ${originator}:\n${message.content}\n`;
}

/**
 * Formats a timestamp into a human-readable string
 * Returns 'Today', 'Yesterday', or 'Dayname DD Month' with time
 * When fullDate is true, adds the full date after Today/Yesterday
 * @param timestamp - The date to format
 * @param fullDate - Whether to include the full date after Today/Yesterday
 */
export const formatChatMessageTimestamp = (timestamp: Date, fullDate: boolean = false): string => {
    
    const date = new Date(timestamp); // This makes the function resilient to getting a Date object or a string in date format
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString(TIMESTAMP_LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    const fullDateStr = date.toLocaleDateString(TIMESTAMP_LOCALE, {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
    });

    if (isToday) {
        return fullDate ? `Today (${fullDateStr}) at ${time}` : `Today at ${time}`;
    } else if (isYesterday) {
        return fullDate ? `Yesterday (${fullDateStr}) at ${time}` : `Yesterday at ${time}`;
    } else {
        return `${fullDateStr} at ${time}`;
    }
}; 