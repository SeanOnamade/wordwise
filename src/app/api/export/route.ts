import { NextResponse } from 'next/server';
import { Packer, Document, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType } from 'docx';
import { exportToPdf } from '@/lib/exportToPdf';

// Enhanced HTML parser that preserves formatting
interface FormattedText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  isHeading?: number; // 1-6 for h1-h6
}

const parseHTMLToFormattedText = (html: string): FormattedText[] => {
  const result: FormattedText[] = [];
  
  const parseNode = (htmlString: string, currentFormat: Partial<FormattedText> = {}, listContext: { type?: 'ul' | 'ol', index?: number } = {}): void => {
    if (!htmlString.trim()) return;
    
    const tagMatch = htmlString.match(/<(\w+)(?:\s[^>]*)?>/);
    
    if (!tagMatch) {
      // No more tags, add remaining text
      const text = htmlString.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      if (text) {
        // Split by newlines to handle paragraph breaks
        const lines = text.split('\n');
        lines.forEach((line, index) => {
          if (line.trim()) {
            result.push({ text: line.trim(), ...currentFormat });
          }
          if (index < lines.length - 1) {
            result.push({ text: '\n' });
          }
        });
      }
      return;
    }
    
    const beforeTag = htmlString.substring(0, tagMatch.index!);
    if (beforeTag.trim()) {
      result.push({ text: beforeTag.trim(), ...currentFormat });
    }
    
    const tagName = tagMatch[1].split(' ')[0].toLowerCase();
    const openTag = tagMatch[0];
    
    // Find the matching closing tag
    let depth = 0;
    let pos = tagMatch.index! + openTag.length;
    let closingTagPos = -1;
    
    while (pos < htmlString.length) {
      const nextOpen = htmlString.indexOf(`<${tagName}`, pos);
      const nextClose = htmlString.indexOf(`</${tagName}>`, pos);
      
      if (nextClose === -1) break;
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + `<${tagName}`.length;
      } else {
        if (depth === 0) {
          closingTagPos = nextClose;
          break;
        }
        depth--;
        pos = nextClose + `</${tagName}>`.length;
      }
    }
    
    if (closingTagPos === -1) {
      // No closing tag found, treat as self-closing or continue parsing
      const remaining = htmlString.substring(tagMatch.index! + openTag.length);
      parseNode(remaining, currentFormat, listContext);
      return;
    }
    
    // Extract content between tags
    const contentStart = tagMatch.index! + openTag.length;
    const content = htmlString.substring(contentStart, closingTagPos);
    const after = htmlString.substring(closingTagPos + `</${tagName}>`.length);
    
    // Determine new formatting and list context
    const newFormat = { ...currentFormat };
    let newListContext = { ...listContext };
    
    switch (tagName) {
      case 'strong':
      case 'b':
        newFormat.bold = true;
        break;
      case 'em':
      case 'i':
        newFormat.italic = true;
        break;
      case 'u':
        newFormat.underline = true;
        break;
      case 's':
      case 'strike':
      case 'del':
        newFormat.strikethrough = true;
        break;
      case 'h1':
        newFormat.isHeading = 1;
        newFormat.bold = true;
        break;
      case 'h2':
        newFormat.isHeading = 2;
        newFormat.bold = true;
        break;
      case 'h3':
        newFormat.isHeading = 3;
        newFormat.bold = true;
        break;
      case 'h4':
        newFormat.isHeading = 4;
        newFormat.bold = true;
        break;
      case 'h5':
        newFormat.isHeading = 5;
        newFormat.bold = true;
        break;
      case 'h6':
        newFormat.isHeading = 6;
        newFormat.bold = true;
        break;
      case 'p':
        // Add paragraph spacing
        if (result.length > 0 && result[result.length - 1].text !== '\n') {
          result.push({ text: '\n' });
        }
        break;
      case 'ul':
        newListContext = { type: 'ul', index: 0 };
        if (result.length > 0 && result[result.length - 1].text !== '\n') {
          result.push({ text: '\n' });
        }
        break;
      case 'ol':
        newListContext = { type: 'ol', index: 0 };
        if (result.length > 0 && result[result.length - 1].text !== '\n') {
          result.push({ text: '\n' });
        }
        break;
      case 'li':
        // Add appropriate bullet or number based on list context
        if (newListContext.type === 'ul') {
          result.push({ text: '• ', ...newFormat });
        } else if (newListContext.type === 'ol') {
          const num = (newListContext.index || 0) + 1;
          result.push({ text: `${num}. `, ...newFormat });
          newListContext.index = num;
        }
        break;
    }
    
    // Parse the content with the new formatting and list context
    if (content.trim()) {
      parseNode(content, newFormat, newListContext);
    }
    
    // Only add spacing after true block elements, not inline formatting
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol'].includes(tagName)) {
      if (result.length > 0 && result[result.length - 1].text !== '\n') {
        result.push({ text: '\n' });
      }
    } else if (tagName === 'li') {
      // Add minimal spacing after list items, but only if not already present
      if (result.length > 0 && result[result.length - 1].text !== '\n') {
        result.push({ text: '\n' });
      }
    }
    
    // Continue parsing the rest
    if (after.trim()) {
      parseNode(after, currentFormat, listContext);
    }
  };
  
  // Start parsing
  parseNode(html);
  
  // Clean up excessive newlines
  const cleaned: FormattedText[] = [];
  let lastWasNewline = false;
  
  for (const item of result) {
    if (item.text === '\n') {
      if (!lastWasNewline) {
        cleaned.push(item);
        lastWasNewline = true;
      }
    } else {
      cleaned.push(item);
      lastWasNewline = false;
    }
  }
  
  return cleaned.length > 0 ? cleaned : [{ text: 'Empty document' }];
};

// Enhanced function to convert HTML to formatted paragraphs
const contentToParagraphs = (content: string): Paragraph[] => {
  const formattedTexts = parseHTMLToFormattedText(content);
  
  if (formattedTexts.length === 0) {
    return [new Paragraph({ children: [new TextRun('')] })];
  }
  
  const paragraphs: Paragraph[] = [];
  let currentTextRuns: TextRun[] = [];
  let isCollectingListItem = false;
  let isNumberedList = false;
  
  for (let i = 0; i < formattedTexts.length; i++) {
    const formatted = formattedTexts[i];
    
    // Skip standalone newlines
    if (formatted.text === '\n') {
      // If we have accumulated text runs, create a paragraph
      if (currentTextRuns.length > 0) {
        if (isCollectingListItem) {
          // Create list item
          paragraphs.push(new Paragraph({
            children: currentTextRuns,
            bullet: isNumberedList ? undefined : { level: 0 },
            numbering: isNumberedList ? { reference: "default-numbering", level: 0 } : undefined,
            spacing: { after: 50 }
          }));
          isCollectingListItem = false;
        } else {
          // Create regular paragraph
          paragraphs.push(new Paragraph({
            children: currentTextRuns,
            spacing: { after: 100 }
          }));
        }
        currentTextRuns = [];
      }
      continue;
    }
    
    // Check if this is a list marker
    if (formatted.text === '• ' || /^\d+\.\s$/.test(formatted.text)) {
      // If we have existing content, finish it first
      if (currentTextRuns.length > 0) {
        paragraphs.push(new Paragraph({
          children: currentTextRuns,
          spacing: { after: 100 }
        }));
        currentTextRuns = [];
      }
      
      isCollectingListItem = true;
      isNumberedList = /^\d+\.\s$/.test(formatted.text);
      // Don't add the marker to the text runs - DOCX will handle it
      continue;
    }
    
    // Handle headings specially
    if (formatted.isHeading) {
      // Finish any current content
      if (currentTextRuns.length > 0) {
        paragraphs.push(new Paragraph({
          children: currentTextRuns,
          spacing: { after: 100 }
        }));
        currentTextRuns = [];
      }
      
      const headingRun = new TextRun({
        text: formatted.text,
        bold: true,
        size: formatted.isHeading === 1 ? 32 : 
              formatted.isHeading === 2 ? 28 : 
              formatted.isHeading === 3 ? 24 : 22,
      });
      
      const headingLevel = 
        formatted.isHeading === 1 ? HeadingLevel.HEADING_1 :
        formatted.isHeading === 2 ? HeadingLevel.HEADING_2 :
        formatted.isHeading === 3 ? HeadingLevel.HEADING_3 :
        HeadingLevel.HEADING_4;
      
      paragraphs.push(new Paragraph({
        heading: headingLevel,
        children: [headingRun],
        spacing: { before: 300, after: 200 }
      }));
      
      continue;
    }
    
    // Regular text - add to current runs
    if (formatted.text.trim()) {
      const textRun = new TextRun({
        text: formatted.text,
        bold: formatted.bold,
        italics: formatted.italic,
        underline: formatted.underline ? {} : undefined,
        strike: formatted.strikethrough,
        size: 22,
      });
      
      currentTextRuns.push(textRun);
    }
  }
  
  // Handle any remaining content
  if (currentTextRuns.length > 0) {
    if (isCollectingListItem) {
      paragraphs.push(new Paragraph({
        children: currentTextRuns,
        bullet: isNumberedList ? undefined : { level: 0 },
        numbering: isNumberedList ? { reference: "default-numbering", level: 0 } : undefined,
        spacing: { after: 50 }
      }));
    } else {
      paragraphs.push(new Paragraph({
        children: currentTextRuns,
        spacing: { after: 100 }
      }));
    }
  }
  
  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('')] })];
};

// Enhanced function to convert HTML to plain text
const contentToPlainText = (content: string): string => {
  // Parse HTML to get structured content
  const formattedTexts = parseHTMLToFormattedText(content);
  
  if (formattedTexts.length === 0) {
    return 'Empty document';
  }
  
  let plainText = '';
  let lastWasNewline = false;
  
  formattedTexts.forEach((formatted, index) => {
    if (formatted.text === '\n') {
      if (!lastWasNewline) {
        plainText += '\n';
        lastWasNewline = true;
      }
      return;
    }
    
    let textToAdd = formatted.text;
    
    // Add formatting indicators for headings
    if (formatted.isHeading) {
      const headingMarker = '='.repeat(formatted.isHeading === 1 ? 60 : 
                                      formatted.isHeading === 2 ? 40 : 20);
      
      if (!lastWasNewline && plainText.length > 0) {
        plainText += '\n\n';
      }
      
      plainText += `${headingMarker}\n`;
      plainText += `${textToAdd.toUpperCase()}\n`;
      plainText += `${headingMarker}\n\n`;
      lastWasNewline = true;
      return;
    }
    
    // Add visual indicators for formatting
    if (formatted.bold && formatted.italic) {
      textToAdd = `***${textToAdd}***`;
    } else if (formatted.bold) {
      textToAdd = `**${textToAdd}**`;
    } else if (formatted.italic) {
      textToAdd = `*${textToAdd}*`;
    }
    
    if (formatted.underline) {
      textToAdd = `_${textToAdd}_`;
    }
    
    if (formatted.strikethrough) {
      textToAdd = `~~${textToAdd}~~`;
    }
    
    plainText += textToAdd;
    lastWasNewline = false;
  });
  
  // Clean up and format
  plainText = plainText
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();

  // If empty, return a placeholder
  return plainText || 'Empty document';
};

// Sanitize filename for safe download
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100); // Limit length
};

export async function POST(request: Request) {
  try {
    const { content, title, format } = await request.json();

    if (!content || !format) {
      return NextResponse.json(
        { error: 'Content and format are required' },
        { status: 400 }
      );
    }

    if (!['pdf', 'docx', 'txt'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be pdf, docx, or txt' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    let mimeType: string;
    let filename: string;

    const sanitizedTitle = sanitizeFilename(title || 'document');

    if (format === 'txt') {
      // Enhanced TXT formatting with better list handling
      let txtContent = content
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (match: string, text: string) => {
          const level = parseInt(match.match(/<h([1-6])/)?.[1] || '1');
          const prefix = '='.repeat(Math.max(1, 7 - level));
          return `\n${prefix} ${text.replace(/<[^>]*>/g, '').toUpperCase()} ${prefix}\n`;
        })
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
        .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
        .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
        .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
        // Handle lists with proper formatting
        .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match: string, content: string) => {
          const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
          const formattedItems = items.map((item: string) => {
            const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').replace(/<[^>]*>/g, '').trim();
            return `  • ${text}`;
          });
          return '\n' + formattedItems.join('\n') + '\n';
        })
        .replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match: string, content: string) => {
          const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
          const formattedItems = items.map((item: string, index: number) => {
            const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').replace(/<[^>]*>/g, '').trim();
            return `  ${index + 1}. ${text}`;
          });
          return '\n' + formattedItems.join('\n') + '\n';
        })
        // Clean up any remaining HTML tags
        .replace(/<[^>]*>/g, '')
        // Fix multiple newlines and spacing
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .trim();

      return new NextResponse(txtContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.txt"`,
        },
      });
    } else if (format === 'docx') {
      // Create DOCX using docx package with enhanced formatting
      const paragraphs = contentToParagraphs(content);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
        numbering: {
          config: [{
            reference: "default-numbering",
            levels: [{
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 260 },
                },
              },
            }],
          }],
        },
      });
      
      buffer = await Packer.toBuffer(doc);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${sanitizedTitle}.docx`;
    } else {
      // Create PDF using our enhanced export utility
      buffer = await exportToPdf({ html: content, title: sanitizedTitle });
      mimeType = 'application/pdf';
      filename = `${sanitizedTitle}.pdf`;
    }

    // Log export for performance monitoring
    console.log(`📤 Document exported: ${filename} (${format.toUpperCase()}, ${Math.round(buffer.length / 1024)}KB)`);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Error exporting document:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
} 