import { NextResponse } from 'next/server';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';
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
  
  // Enhanced HTML parser that handles nested formatting and structure
  const parseNode = (htmlString: string, currentFormat: Partial<FormattedText> = {}): void => {
    // Handle self-closing tags and line breaks
    htmlString = htmlString.replace(/<br\s*\/?>/gi, '\n');
    htmlString = htmlString.replace(/<\/p>/gi, '</p>\n');
    htmlString = htmlString.replace(/<\/li>/gi, '</li>\n');
    htmlString = htmlString.replace(/<\/h[1-6]>/gi, (match) => match + '\n');
    
    // Find the next opening tag
    const tagMatch = htmlString.match(/<([^>\/]+)>/);
    if (!tagMatch) {
      // No more tags, just text content
      const text = htmlString.replace(/<[^>]*>/g, '').trim();
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
      parseNode(remaining, currentFormat);
      return;
    }
    
    // Extract content between tags
    const contentStart = tagMatch.index! + openTag.length;
    const content = htmlString.substring(contentStart, closingTagPos);
    const after = htmlString.substring(closingTagPos + `</${tagName}>`.length);
    
    // Determine new formatting
    const newFormat = { ...currentFormat };
    
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
       case 'li':
         result.push({ text: '• ' });
         break;
       case 'ul':
       case 'ol':
         if (result.length > 0 && result[result.length - 1].text !== '\n') {
           result.push({ text: '\n' });
         }
         break;
     }
     
     // Parse the content with the new formatting
     if (content.trim()) {
       parseNode(content, newFormat);
     }
     
     // Only add spacing after true block elements, not inline formatting
     if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'].includes(tagName)) {
       if (result.length > 0 && result[result.length - 1].text !== '\n') {
         result.push({ text: '\n' });
       }
     }
    
    // Continue parsing the rest
    if (after.trim()) {
      parseNode(after, currentFormat);
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
  let currentChildren: TextRun[] = [];
  
  formattedTexts.forEach((formatted) => {
    if (formatted.text === '\n') {
      // End current paragraph and start new one
      if (currentChildren.length > 0) {
        paragraphs.push(new Paragraph({ children: currentChildren }));
        currentChildren = [];
      }
      return;
    }
    
    const textRun = new TextRun({
      text: formatted.text,
      bold: formatted.bold,
      italics: formatted.italic,
      underline: formatted.underline ? {} : undefined,
      strike: formatted.strikethrough,
    });
    
    if (formatted.isHeading) {
      // Create heading paragraph
      if (currentChildren.length > 0) {
        paragraphs.push(new Paragraph({ children: currentChildren }));
        currentChildren = [];
      }
      
      const headingLevel = 
        formatted.isHeading === 1 ? HeadingLevel.HEADING_1 :
        formatted.isHeading === 2 ? HeadingLevel.HEADING_2 :
        HeadingLevel.HEADING_3;
      
      paragraphs.push(new Paragraph({
        heading: headingLevel,
        children: [textRun]
      }));
    } else {
      currentChildren.push(textRun);
    }
  });
  
  if (currentChildren.length > 0) {
    paragraphs.push(new Paragraph({ children: currentChildren }));
  }
  
  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun('')] })];
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

    if (!['docx', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be docx or pdf' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    let mimeType: string;
    let filename: string;

    if (format === 'docx') {
      // Create DOCX using docx package
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun(content)]
            })
          ]
        }]
      });
      
      buffer = await Packer.toBuffer(doc);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${title || 'document'}.docx`;
    } else {
      // Create PDF using our new export utility
      buffer = await exportToPdf({ html: content, title });
      mimeType = 'application/pdf';
      filename = `${title || 'wordwise-export'}.pdf`;
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting document:', error);
    return NextResponse.json(
      { error: 'Failed to export document' },
      { status: 500 }
    );
  }
} 