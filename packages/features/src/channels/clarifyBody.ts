/** Extracts question + numbered choices from a clarify prompt message body. */
export function parseClarifyBody(body: string | null | undefined): { question: string; choices: string[] | null } | null {
  if (!body || !body.trim()) return null;

  const lines = body.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return null;

  const choicePattern = /^(\d+)\.\s+(.+)/;
  const choiceLines: number[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(choicePattern);
    if (match) {
      choiceLines.unshift(i);
    } else {
      break;
    }
  }

  if (choiceLines.length >= 2) {
    const choices = choiceLines.map(i => {
      const match = lines[i].match(choicePattern);
      return match ? match[2].trim() : lines[i];
    });
    const questionLines = lines.slice(0, choiceLines[0]).filter(line => line.length > 0);
    const question = questionLines.join('\n');
    return { question: question || body, choices };
  }

  return null;
}
