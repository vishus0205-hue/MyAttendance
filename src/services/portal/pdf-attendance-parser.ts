import { RawAttendanceItem } from "./portal-adapter.interface";

function cleanSubjectName(raw: string): string {
  const cleaned = raw.replace(/(?:T2|P2|T1|P1)\s*(?:MBA\s*Tech|MBATech|ALL)?.*$/i, "").trim();
  if (/Image and Vid/i.test(cleaned)) return "Image and Video Processing";
  if (/Artificial Intellige/i.test(cleaned)) return "Artificial Intelligence";
  if (/Mobile Application/i.test(cleaned)) return "Mobile Application Development";
  if (/AI Recept/i.test(cleaned)) return "AI Reception & Software Development";
  if (/Fundamentals of Climate/i.test(cleaned)) return "Fundamentals of Climate Change";
  if (/Management Through Movies/i.test(cleaned)) return "Management Through Movies";
  if (/Operating Systems/i.test(cleaned)) return "Operating Systems";
  if (/Software Engineering/i.test(cleaned)) return "Software Engineering";
  return cleaned;
}

export function parsePdfAttendanceItems(fullText: string): RawAttendanceItem[] {
  const datePattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/g;
  const datePositions = Array.from(fullText.matchAll(datePattern), (match) => ({
    date: match[1],
    index: match.index,
  }));
  if (datePositions.length === 0) {
    throw new Error("Attendance PDF contains no recognizable attendance dates.");
  }

  return datePositions.map((cur, index) => {
    const prevIndex = index === 0 ? 0 : datePositions[index - 1].index + datePositions[index - 1].date.length;
    const nextIndex = index < datePositions.length - 1 ? datePositions[index + 1].index : fullText.length;
    const beforeText = fullText.substring(prevIndex, cur.index);
    const afterText = fullText.substring(cur.index + cur.date.length, nextIndex);
    const matchCourse = beforeText.match(/(?:^|\n)\s*(\d+)\s*(?:\r?\n|\t)\s*([^\r\n\t]+?)\s*$/);
    const subjectName = matchCourse ? cleanSubjectName(matchCourse[2]) : "";
    const matchStatus = afterText.match(/(?:AM|PM)\s*\n\s*([PAEL]|NU)\b/) || afterText.match(/(?:^|\n)\s*([PAEL]|NU)\s*(?:\n|$)/);

    if (!subjectName || !matchStatus) {
      throw new Error(`Attendance PDF row for ${cur.date} is missing a recognizable subject or status.`);
    }
    return { date: cur.date, subjectName, status: matchStatus[1].toUpperCase() };
  });
}
