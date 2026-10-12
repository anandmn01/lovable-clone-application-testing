import { useMemo } from 'react';
import { ChatEvent, ChatEventType } from '@/lib/types';

// Regex to capture the three specific tags we support
// Matches: <tag attributes>content</tag>
// Note: This regex is designed to be lenient for streaming (doesn't require strict closing for the last item)
const PARSE_REGEX = /<(tool|message|file)(?:[^>]*)>([\s\S]*?)(?:<\/\1>|$)/gi;
const ATTR_REGEX = /(?:path|args)=["']([^"']+)["']/i;

export const useStreamParser = (streamBuffer: string) => {
  return useMemo(() => {
    if (!streamBuffer) return [];
    const events: ChatEvent[] = [];
    let match: RegExpExecArray | null;

    // Strip code fence if model wrapped the stream
    const cleanBuffer = streamBuffer.replace(/^```[a-zA-Z]*\s*/i, "");
    
    // Reset regex index
    PARSE_REGEX.lastIndex = 0;

    while ((match = PARSE_REGEX.exec(cleanBuffer)) !== null) {
      const [fullMatch, tagName, content] = match;
      const typeStr = tagName.toLowerCase();
      
      // Extract attributes from the opening tag part of the match (we need to re-match the opening tag)
      // This is a simplified extraction. In production, you might want a more robust attribute parser.
      const openTagMatch = streamBuffer.substring(match.index, match.index + fullMatch.indexOf('>') + 1); 
      const attrMatch = ATTR_REGEX.exec(openTagMatch);
      const attrValue = attrMatch ? attrMatch[1] : undefined;

      let type: ChatEventType = ChatEventType.MESSAGE;
      let filePath: string | undefined;
      let metadata: string | undefined;

      if (typeStr === 'tool') {
        type = ChatEventType.TOOL_LOG;
        metadata = attrValue;
      } else if (typeStr === 'file') {
        type = ChatEventType.FILE_EDIT;
        filePath = attrValue;

        // If this file has already been edited in this turn, update the existing event instead of adding a duplicate
        if (filePath) {
          const existingIndex = events.findIndex(e => e.type === ChatEventType.FILE_EDIT && e.filePath === filePath);
          if (existingIndex !== -1) {
            events[existingIndex] = {
              type,
              content: content.trim(),
              filePath,
              metadata
            };
            continue;
          }
        }
      }

      events.push({
        type,
        content: content.trim(),
        filePath,
        metadata
      });
    }


    return events;
  }, [streamBuffer]);
};