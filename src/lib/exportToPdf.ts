'use server';

import { PDFDocument, StandardFonts, PDFPage } from 'pdf-lib';

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

interface FormattedText {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrike?: boolean;
  isHeading?: 1 | 2 | 3;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

function stripGrammarHighlights(html: string): string {
  // Remove grammar check highlights but keep their text content
  let cleanHtml = html;
  
  // Remove mark tags with data-suggestion-id
  cleanHtml = cleanHtml.replace(/<mark[^>]*data-suggestion-id[^>]*>(.*?)<\/mark>/gi, '$1');
  
  // Remove elements with lt-error class
  cleanHtml = cleanHtml.replace(/<[^>]*class="[^"]*lt-error[^"]*"[^>]*>(.*?)<\/[^>]+>/gi, '$1');
  
  // Remove elements with suggestion-highlight class
  cleanHtml = cleanHtml.replace(/<[^>]*class="[^"]*suggestion-highlight[^"]*"[^>]*>(.*?)<\/[^>]+>/gi, '$1');
  
  // Remove any remaining grammar-related classes
  cleanHtml = cleanHtml.replace(/class="[^"]*hl-[^"]*"/gi, '');
  
  return cleanHtml;
}

function parseHTML(html: string): FormattedText[] {
  // First strip grammar highlights
  const cleanHtml = stripGrammarHighlights(html);
  const result: FormattedText[] = [];

  // Simple HTML parser using regex
  const parseElement = (htmlString: string, currentFormat: Partial<FormattedText> = {}): void => {
    // Handle line breaks
    htmlString = htmlString.replace(/<br\s*\/?>/gi, '\n');
    
    // Find the next opening tag
    const tagMatch = htmlString.match(/<([^\/][^>]*)>/);
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
        });
      }
      return;
    }

    const beforeTag = htmlString.substring(0, tagMatch.index!);
    if (beforeTag.trim()) {
      result.push({ text: beforeTag.trim(), ...currentFormat });
    }

    const fullTag = tagMatch[0];
    const tagContent = tagMatch[1];
    const tagName = tagContent.split(' ')[0].toLowerCase();
    
    // Find the matching closing tag
    const closingTag = `</${tagName}>`;
    const closingIndex = htmlString.indexOf(closingTag, tagMatch.index! + fullTag.length);
    
    if (closingIndex === -1) {
      // No closing tag, continue parsing
      const remaining = htmlString.substring(tagMatch.index! + fullTag.length);
      parseElement(remaining, currentFormat);
      return;
    }

    // Extract content between tags
    const contentStart = tagMatch.index! + fullTag.length;
    const content = htmlString.substring(contentStart, closingIndex);
    const after = htmlString.substring(closingIndex + closingTag.length);

    // Determine new formatting based on tag
    const newFormat = { ...currentFormat };
    
    // Get alignment from style or class
    let alignment: FormattedText['alignment'] = currentFormat.alignment || 'left';
    if (fullTag.includes('text-align: center') || fullTag.includes('align-center')) alignment = 'center';
    else if (fullTag.includes('text-align: right') || fullTag.includes('align-right')) alignment = 'right';
    else if (fullTag.includes('text-align: justify') || fullTag.includes('align-justify')) alignment = 'justify';
    
    newFormat.alignment = alignment;

    switch (tagName) {
      case 'strong':
      case 'b':
        newFormat.isBold = true;
        break;
      case 'em':
      case 'i':
        newFormat.isItalic = true;
        break;
      case 'u':
        newFormat.isUnderline = true;
        break;
      case 's':
      case 'strike':
      case 'del':
        newFormat.isStrike = true;
        break;
      case 'h1':
        newFormat.isHeading = 1;
        newFormat.isBold = true;
        break;
      case 'h2':
        newFormat.isHeading = 2;
        newFormat.isBold = true;
        break;
      case 'h3':
        newFormat.isHeading = 3;
        newFormat.isBold = true;
        break;
      case 'li':
        // Add bullet point for list items
        if (content.trim()) {
          result.push({ text: '• ' + content.replace(/<[^>]*>/g, '').trim(), ...newFormat });
        }
        if (after.trim()) {
          parseElement(after, currentFormat);
        }
        return;
      case 'p':
      case 'div':
        // Add paragraph spacing
        if (result.length > 0) {
          result.push({ text: '\n' });
        }
        break;
    }

    // Parse the content with the new formatting
    if (content.trim()) {
      parseElement(content, newFormat);
    }

    // Add spacing after block elements
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      result.push({ text: '\n' });
    }

    // Continue parsing the rest
    if (after.trim()) {
      parseElement(after, currentFormat);
    }
  };

  // Start parsing
  parseElement(cleanHtml);

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
}

export async function exportToPdf({ html, title = 'wordwise-export' }: ExportToPdfOptions): Promise<Buffer> {
  try {
    // Parse HTML content
    const formattedText = parseHTML(html);

    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size in points

    // Embed fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    // Set up page margins and content area
    const margin = 56.7; // 2cm in points
    const contentWidth = currentPage.getWidth() - (margin * 2);
    let y = currentPage.getHeight() - margin;

    // Draw content
    for (const text of formattedText) {
      if (text.text === '\n') {
        y -= 14 * 1.5; // Standard line height
        continue;
      }

      // Select font based on formatting
      let font = regularFont;
      if (text.isBold && text.isItalic) font = boldItalicFont;
      else if (text.isBold) font = boldFont;
      else if (text.isItalic) font = italicFont;

      // Set font size based on heading level
      let fontSize = 14;
      if (text.isHeading === 1) fontSize = 28;
      else if (text.isHeading === 2) fontSize = 24;
      else if (text.isHeading === 3) fontSize = 20;

      const lineHeight = fontSize * 1.5;

      // Add new page if needed
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        y = currentPage.getHeight() - margin;
      }

      // Calculate x position based on alignment
      let x = margin;
      const textWidth = font.widthOfTextAtSize(text.text, fontSize);
      if (text.alignment === 'center') x = margin + (contentWidth - textWidth) / 2;
      else if (text.alignment === 'right') x = margin + contentWidth - textWidth;

      // Draw text
      currentPage.drawText(text.text, {
        x,
        y,
        size: fontSize,
        font,
        lineHeight,
        maxWidth: contentWidth
      });

      // Add underline or strikethrough if needed
      if (text.isUnderline || text.isStrike) {
        const lineY = text.isUnderline ? y - 2 : y + fontSize * 0.3;
        currentPage.drawLine({
          start: { x, y: lineY },
          end: { x: x + textWidth, y: lineY },
          thickness: 1
        });
      }

      // Move to next line
      y -= lineHeight;

      // Add extra spacing after headings
      if (text.isHeading) y -= fontSize * 0.5;
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error in exportToPdf:', error);
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