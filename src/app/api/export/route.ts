import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';

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
    const { content, format } = await request.json();

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

    if (format === 'docx') {
      // Create DOCX using docx package
      const paragraphs = contentToParagraphs(content);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });
      
      buffer = await Packer.toBuffer(doc);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      // Create PDF using pdf-lib with formatting preservation
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      
      // Embed fonts for different styles
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
      
      const { width, height } = page.getSize();
      const fontSize = 12;
      const headingFontSize = 16;
      const lineHeight = fontSize * 1.4;
      const margin = 50;
      
      const formattedTexts = parseHTMLToFormattedText(content);
      let y = height - margin;
      const maxWidth = width - (margin * 2);
      
      // Helper function to combine text segments into lines for mixed formatting
      const buildMixedFormattedLines = (texts: FormattedText[]): Array<{segments: FormattedText[], isHeading: boolean}> => {
        const lines: Array<{segments: FormattedText[], isHeading: boolean}> = [];
        let currentSegments: FormattedText[] = [];
        let currentIsHeading = false;
        
        for (const text of texts) {
          if (text.text === '\n') {
            if (currentSegments.length > 0) {
              lines.push({ segments: currentSegments, isHeading: currentIsHeading });
              currentSegments = [];
              currentIsHeading = false;
            }
          } else if (text.isHeading) {
            // Headings start a new line
            if (currentSegments.length > 0) {
              lines.push({ segments: currentSegments, isHeading: currentIsHeading });
            }
            lines.push({ segments: [text], isHeading: true });
            currentSegments = [];
            currentIsHeading = false;
          } else {
            currentSegments.push(text);
            currentIsHeading = currentIsHeading || !!text.isHeading;
          }
        }
        
        if (currentSegments.length > 0) {
          lines.push({ segments: currentSegments, isHeading: currentIsHeading });
        }
        
        return lines;
      };
      
      // Helper function to wrap mixed formatted text
      const wrapMixedFormattedLine = (segments: FormattedText[], maxWidth: number) => {
        const lines: Array<{text: string, format: FormattedText}[]> = [];
        let currentLine: {text: string, format: FormattedText}[] = [];
        let currentLineWidth = 0;
        
        for (const segment of segments) {
          const words = segment.text.split(' ');
          
          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const wordWithSpace = (i === 0 && currentLine.length === 0) ? word : ' ' + word;
            
                         // Get font for this segment
             let font = regularFont;
             let segmentFontSize = segment.isHeading ? headingFontSize : fontSize;
             
             if (segment.isHeading) {
               font = boldFont;
             } else if (segment.bold && segment.italic) {
               font = boldItalicFont;
             } else if (segment.bold) {
               font = boldFont;
             } else if (segment.italic) {
               font = italicFont;
             }
             
             const wordWidth = font.widthOfTextAtSize(wordWithSpace, segmentFontSize);
            
            if (currentLineWidth + wordWidth <= maxWidth || currentLine.length === 0) {
              currentLine.push({ text: wordWithSpace, format: segment });
              currentLineWidth += wordWidth;
                         } else {
               lines.push(currentLine);
               currentLine = [{ text: word, format: segment }];
               currentLineWidth = font.widthOfTextAtSize(word, segmentFontSize);
             }
          }
        }
        
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        
        return lines;
      };
      
      const formattedLines = buildMixedFormattedLines(formattedTexts);
      
      for (const line of formattedLines) {
        if (line.segments.length === 0) continue;
        
        const wrappedLines = wrapMixedFormattedLine(line.segments, maxWidth);
        
        for (const wrappedLine of wrappedLines) {
          // Check if we need a new page
          const maxFontSize = Math.max(...wrappedLine.map(seg => seg.format.isHeading ? headingFontSize : fontSize));
          if (y < margin + maxFontSize + 10) {
            page = pdfDoc.addPage();
            y = page.getSize().height - margin;
          }
          
          let currentX = margin;
          
          // Draw each segment in the line
          for (const segment of wrappedLine) {
            const format = segment.format;
            
            // Determine font based on formatting
            let font = regularFont;
            let currentFontSize = format.isHeading ? headingFontSize : fontSize;
            
            if (format.isHeading) {
              font = boldFont;
            } else if (format.bold && format.italic) {
              font = boldItalicFont;
            } else if (format.bold) {
              font = boldFont;
            } else if (format.italic) {
              font = italicFont;
            }
            
            // Draw text segment
            page.drawText(segment.text, {
              x: currentX,
              y,
              size: currentFontSize,
              font,
              color: rgb(0, 0, 0),
            });
            
            const segmentWidth = font.widthOfTextAtSize(segment.text, currentFontSize);
            
            // Add strikethrough line if needed
            if (format.strikethrough) {
              page.drawLine({
                start: { x: currentX, y: y + currentFontSize * 0.3 },
                end: { x: currentX + segmentWidth, y: y + currentFontSize * 0.3 },
                thickness: 1,
                color: rgb(0, 0, 0),
              });
            }
            
            // Add underline if needed
            if (format.underline) {
              page.drawLine({
                start: { x: currentX, y: y - 2 },
                end: { x: currentX + segmentWidth, y: y - 2 },
                thickness: 1,
                color: rgb(0, 0, 0),
              });
            }
            
            currentX += segmentWidth;
          }
          
          y -= lineHeight;
        }
        
        // Add extra spacing after headings
        if (line.isHeading) {
          y -= 8;
        }
      }
      
      buffer = Buffer.from(await pdfDoc.save());
      mimeType = 'application/pdf';
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="document.${format}"`,
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