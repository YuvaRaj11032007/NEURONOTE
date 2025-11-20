
export async function extractTextFromPPTX(file: File): Promise<{ fullText: string, slides: any[] }> {
  // @ts-ignore - JSZip is loaded via CDN in index.html
  if (!window.JSZip) {
    throw new Error("JSZip library not loaded. Please check your internet connection.");
  }

  // @ts-ignore
  const zip = await window.JSZip.loadAsync(file);
  
  const slidePromises: Promise<{index: number, type: 'slide' | 'note', text: string}>[] = [];

  // robust regex to extract text between <a:t> tags, handling potential attributes
  const extractText = (xml: string) => {
     // Matches <a:t>...</a:t> or <a:t ...>...</a:t>
     const regex = /<a:t[^>]*>(.*?)<\/a:t>/g;
     let text = "";
     let match;
     while ((match = regex.exec(xml)) !== null) {
         text += match[1] + " ";
     }
     return text.trim();
  };

  // Iterate over files in the zip
  zip.forEach((relativePath: string, zipEntry: any) => {
    // Match Slides (e.g., ppt/slides/slide1.xml)
    const slideMatch = relativePath.match(/ppt\/slides\/slide(\d+)\.xml/);
    if (slideMatch) {
        const index = parseInt(slideMatch[1]);
        slidePromises.push(
            zipEntry.async("string").then((content: string) => ({
                index,
                type: 'slide',
                text: extractText(content)
            }))
        );
    }

    // Match Notes (Speaker Notes) (e.g., ppt/notesSlides/notesSlide1.xml)
    const noteMatch = relativePath.match(/ppt\/notesSlides\/notesSlide(\d+)\.xml/);
    if (noteMatch) {
        const index = parseInt(noteMatch[1]);
        slidePromises.push(
            zipEntry.async("string").then((content: string) => ({
                index,
                type: 'note',
                text: extractText(content)
            }))
        );
    }
  });

  const results = await Promise.all(slidePromises);

  // Sort by slide index
  results.sort((a, b) => a.index - b.index);

  // Group by index to combine Slide + Note
  const slidesMap = new Map<number, {slide: string, note: string}>();
  
  results.forEach(item => {
      if (!slidesMap.has(item.index)) slidesMap.set(item.index, { slide: '', note: '' });
      const entry = slidesMap.get(item.index)!;
      if (item.type === 'slide') entry.slide = item.text;
      if (item.type === 'note') entry.note = item.text;
  });

  let fullText = `--- PPTX Content: ${file.name} ---\n\n`;
  const slidesArray: any[] = [];
  
  // Convert Map to sorted text
  const sortedIndices = Array.from(slidesMap.keys()).sort((a, b) => a - b);
  
  if (sortedIndices.length === 0) {
       return { 
           fullText: `Processed ${file.name}, but found no slides. This might be an older PPT format (binary) or image-only.`,
           slides: []
       };
  }

  for (const idx of sortedIndices) {
      const entry = slidesMap.get(idx)!;
      // Only add if there is content
      if (entry.slide.trim() || entry.note.trim()) {
          fullText += `[Slide ${idx}]:\n${entry.slide}\n`;
          if (entry.note.trim()) {
              fullText += `[Speaker Notes]: ${entry.note}\n`;
          }
          fullText += `\n---\n\n`;
          
          slidesArray.push({
              index: idx,
              content: entry.slide,
              note: entry.note
          });
      }
  }

  return { fullText, slides: slidesArray };
}
