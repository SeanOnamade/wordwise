'use server';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { parse } from 'node-html-parser';

// CSS styles for PDF export
const PDF_STYLES = `
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

body {
  font-family: 'Inter', sans-serif;
  margin: 2cm;
  line-height: 1.5;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 16px;
}

h2 {
  font-size: 24px;
  font-weight: 700;
  margin-top: 24px;
}

h3 {
  font-size: 20px;
  font-weight: 700;
  margin-top: 20px;
}

p {
  font-size: 14px;
  line-height: 1.5;
  margin: 8px 0;
}

.ProseMirror ul li {
  list-style: disc inside;
}

.ProseMirror ol li {
  list-style: decimal inside;
}

.is-bold {
  font-weight: 700;
}

.is-italic {
  font-style: italic;
}

.is-underline {
  text-decoration: underline;
}

.is-strike {
  text-decoration: line-through;
}

.align-center {
  text-align: center;
}

.align-right {
  text-align: right;
}

.align-justify {
  text-align: justify;
}

img {
  max-width: 100%;
  height: auto;
}

/* Hide grammar highlights */
.lt-error,
mark[data-suggestion-id] {
  background-color: transparent !important;
  border-bottom: none !important;
}
`;

interface ExportToPdfOptions {
  html: string;
  title?: string;
}

interface ParsedElement {
  type: 'text' | 'heading' | 'paragraph' | 'list-item' | 'break';
  content: string;
  formatting: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    heading?: 1 | 2 | 3 | 4 | 5 | 6;
    alignment?: 'left' | 'center' | 'right' | 'justify';
  };
  listLevel?: number;
  isOrderedList?: boolean;
}

function stripGrammarHighlights(html: string): string {
  return html
    .replace(/<mark[^>]*data-suggestion-id[^>]*>(.*?)<\/mark>/gi, '$1')
    .replace(/<[^>]*class="[^"]*lt-error[^"]*"[^>]*>(.*?)<\/[^>]+>/gi, '$1')
    .replace(/<[^>]*class="[^"]*suggestion-highlight[^"]*"[^>]*>(.*?)<\/[^>]+>/gi, '$1')
    .replace(/class="[^"]*hl-[^"]*"/gi, '');
}

function parseHTMLToElements(html: string): ParsedElement[] {
  const cleanHtml = stripGrammarHighlights(html);
  const elements: ParsedElement[] = [];
  
  // Parse HTML using node-html-parser
  const root = parse(cleanHtml);
  
  function processNode(node: any, inheritedFormatting: ParsedElement['formatting'] = {}): void {
    // Handle text nodes
    if (node.nodeType === 3) { // Text node
      const text = node.text?.trim();
      if (text) {
        elements.push({
          type: 'text',
          content: text,
          formatting: { ...inheritedFormatting }
        });
      }
      return;
    }

    // Handle element nodes
    if (node.nodeType === 1) { // Element node
      const tagName = node.tagName?.toLowerCase();
      const newFormatting = { ...inheritedFormatting };
      
      // Extract alignment from style or class
      const style = node.getAttribute('style') || '';
      const className = node.getAttribute('class') || '';
      
      if (style.includes('text-align: center') || className.includes('align-center')) {
        newFormatting.alignment = 'center';
      } else if (style.includes('text-align: right') || className.includes('align-right')) {
        newFormatting.alignment = 'right';
      } else if (style.includes('text-align: justify') || className.includes('align-justify')) {
        newFormatting.alignment = 'justify';
      }
      
      switch (tagName) {
        case 'strong':
        case 'b':
          newFormatting.bold = true;
          break;
        case 'em':
        case 'i':
          newFormatting.italic = true;
          break;
        case 'u':
          newFormatting.underline = true;
          break;
        case 's':
        case 'strike':
        case 'del':
          newFormatting.strikethrough = true;
          break;
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          newFormatting.heading = parseInt(tagName.charAt(1)) as 1 | 2 | 3 | 4 | 5 | 6;
          newFormatting.bold = true;
          break;
        case 'p':
          // Process paragraph content
          if (node.text?.trim()) {
            node.childNodes.forEach((child: any) => processNode(child, newFormatting));
            elements.push({ type: 'break', content: '', formatting: {} });
          }
          return;
        case 'div':
          // Process div content and add break if needed
          node.childNodes.forEach((child: any) => processNode(child, newFormatting));
          if (node.text?.trim()) {
            elements.push({ type: 'break', content: '', formatting: {} });
          }
          return;
        case 'li':
          const listParent = node.parentNode;
          const isOrdered = listParent?.tagName?.toLowerCase() === 'ol';
          const listLevel = getListLevel(node);
          
          if (node.text?.trim()) {
            elements.push({
              type: 'list-item',
              content: node.text.trim(),
              formatting: newFormatting,
              listLevel,
              isOrderedList: isOrdered
            });
          }
          return;
        case 'br':
          elements.push({ type: 'break', content: '', formatting: {} });
          return;
        case 'ul':
        case 'ol':
          // Process list items
          node.childNodes.forEach((child: any) => processNode(child, newFormatting));
          elements.push({ type: 'break', content: '', formatting: {} });
          return;
      }
      
      // Process child nodes with inherited formatting
      node.childNodes.forEach((child: any) => processNode(child, newFormatting));
      
      // Add spacing after block elements
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        elements.push({ type: 'break', content: '', formatting: {} });
      }
    }
  }
  
  function getListLevel(node: any): number {
    let level = 0;
    let parent = node.parentNode;
    while (parent) {
      if (['ul', 'ol'].includes(parent.tagName?.toLowerCase())) {
        level++;
      }
      parent = parent.parentNode;
    }
    return level;
  }
  
  // Process all root nodes
  root.childNodes.forEach((node: any) => processNode(node));
  
  return elements.length > 0 ? elements : [{ type: 'text', content: 'Empty document', formatting: {} }];
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, break it character by character
        const chars = word.split('');
        let currentChunk = '';
        
        for (const char of chars) {
          const testChunk = currentChunk + char;
          const chunkWidth = font.widthOfTextAtSize(testChunk, fontSize);
          
          if (chunkWidth <= maxWidth) {
            currentChunk = testChunk;
          } else {
            if (currentChunk) {
              lines.push(currentChunk);
              currentChunk = char;
            } else {
              // Even single character is too wide, just add it
              lines.push(char);
            }
          }
        }
        
        if (currentChunk) {
          currentLine = currentChunk;
        }
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [''];
}

export async function exportToPdf({ html, title = 'wordwise-export' }: ExportToPdfOptions): Promise<Buffer> {
  try {
    console.log('🔄 Starting PDF export with enhanced formatting...');
    
    // Parse HTML content
    const elements = parseHTMLToElements(html);
    console.log(`📄 Parsed ${elements.length} elements from HTML`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size

    // Embed fonts
    const fonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
    };

    // Page setup
    const margin = 56.7; // 2cm in points
    const contentWidth = currentPage.getWidth() - (margin * 2);
    let y = currentPage.getHeight() - margin;
    const baseLineHeight = 1.4;
    let listCounters: { [level: number]: number } = {};

    const addNewPageIfNeeded = (requiredHeight: number) => {
      if (y - requiredHeight < margin + 20) { // Add 20pt buffer
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        y = currentPage.getHeight() - margin;
        console.log('📄 Added new page, y reset to:', y);
      }
    };

    const selectFont = (formatting: ParsedElement['formatting']) => {
      if (formatting.bold && formatting.italic) return fonts.boldItalic;
      if (formatting.bold) return fonts.bold;
      if (formatting.italic) return fonts.italic;
      return fonts.regular;
    };

    const getFontSize = (formatting: ParsedElement['formatting']): number => {
      if (formatting.heading) {
        switch (formatting.heading) {
          case 1: return 24; // Reduced from 28
          case 2: return 20; // Reduced from 24
          case 3: return 18; // Reduced from 20
          case 4: return 16;
          case 5: return 14;
          case 6: return 12;
          default: return 12;
        }
      }
      return 11; // Slightly smaller base font
    };

    const getAlignment = (formatting: ParsedElement['formatting'], textWidth: number): number => {
      switch (formatting.alignment) {
        case 'center':
          return margin + (contentWidth - textWidth) / 2;
        case 'right':
          return margin + contentWidth - textWidth;
        case 'justify':
          return margin; // Justification would need word spacing adjustment
        default:
          return margin;
      }
    };

    // Process each element
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      if (element.type === 'break') {
        y -= 12 * baseLineHeight;
        continue;
      }
      
      if (!element.content.trim()) continue;
      
      const font = selectFont(element.formatting);
      const fontSize = getFontSize(element.formatting);
      const lineHeight = fontSize * baseLineHeight;
      
      let content = element.content;
      let x = margin;
      
      // Handle list items
      if (element.type === 'list-item') {
        const level = element.listLevel || 1;
        const indent = (level - 1) * 20;
        x = margin + indent;
        
        if (element.isOrderedList) {
          if (!listCounters[level]) listCounters[level] = 1;
          content = `${listCounters[level]}. ${content}`;
          listCounters[level]++;
          // Reset deeper level counters
          for (let l = level + 1; l <= 10; l++) {
            delete listCounters[l];
          }
        } else {
          const bullets = ['•', '◦', '▪', '▫'];
          const bullet = bullets[(level - 1) % bullets.length];
          content = `${bullet} ${content}`;
        }
      }
      
      // Wrap text to fit page width
      const availableWidth = contentWidth - (x - margin);
      const lines = wrapText(content, font, fontSize, availableWidth);
      
      // Check if we need a new page
      const totalHeight = lines.length * lineHeight + (element.formatting.heading ? lineHeight * 0.5 : 0);
      addNewPageIfNeeded(totalHeight);
      
      // Draw each line
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        const lineX = lineIndex === 0 ? getAlignment(element.formatting, textWidth) : x;
        
        // Draw text
        currentPage.drawText(line, {
          x: lineX,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
        
        // Draw underline or strikethrough
        if (element.formatting.underline) {
          currentPage.drawLine({
            start: { x: lineX, y: y - 2 },
            end: { x: lineX + textWidth, y: y - 2 },
            thickness: 0.5,
            color: rgb(0, 0, 0)
          });
        }
        
        if (element.formatting.strikethrough) {
          currentPage.drawLine({
            start: { x: lineX, y: y + fontSize * 0.3 },
            end: { x: lineX + textWidth, y: y + fontSize * 0.3 },
            thickness: 0.5,
            color: rgb(0, 0, 0)
          });
        }
        
        y -= lineHeight;
      }
      
      // Add extra spacing after headings
      if (element.formatting.heading) {
        y -= lineHeight * 0.3;
      }
    }

    console.log('✅ PDF generation completed successfully');
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('❌ Error in exportToPdf:', error);
    throw error;
  }
}

// Debug route handler
export async function handleDebugExport(html: string): Promise<{ pdf: Buffer; sizeInKb: number }> {
  const pdf = await exportToPdf({ html });
  const sizeInKb = Math.round(pdf.length / 1024);
  console.log('🖨️ PDF bytes', sizeInKb);
  return { pdf, sizeInKb };
} 