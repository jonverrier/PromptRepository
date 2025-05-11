/**
 * @module FormatChatMessage
 * 
 * Utilities for formatting chat messages and timestamps into human-readable text.
 * Provides functions to render chat messages with timestamps and format dates
 * using friendly relative terms like 'Today' and 'Yesterday'.
 */
// Copyright (c) 2025 Jon Verrier


import { EChatRole, IChatMessage } from "./entry";

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

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const fullDateStr = date.toLocaleDateString('en-US', { 
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