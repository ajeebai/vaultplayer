
export const srtToVtt = (srtText: string): string => {
  let vttContent = "WEBVTT\n\n";
  const lines = srtText.trim().split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    // Check for sequence number
    if (/^\d+$/.test(lines[i])) {
      // It's a sequence number, the next line is the timestamp
      if (i + 1 < lines.length && lines[i+1].includes('-->')) {
        // Replace comma with dot in timestamps
        const timestamp = lines[i+1].replace(/,/g, '.');
        vttContent += `${timestamp}\n`;
        i++; // Move past the timestamp line
        
        // The following lines are the subtitle text until a blank line
        let subtitleText = '';
        while (i + 1 < lines.length && lines[i+1].trim() !== '') {
          i++;
          subtitleText += lines[i] + '\n';
        }
        vttContent += subtitleText.trim() + '\n\n';
      }
    }
  }
  return vttContent;
};
