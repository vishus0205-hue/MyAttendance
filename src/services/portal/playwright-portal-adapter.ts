import { chromium, Browser, BrowserContext } from "playwright";
import {
  IPortalAdapter,
  PortalCredentials,
  ConnectionTestResult,
  DateRange,
  RawAttendanceReport,
  NormalizedAttendanceRecord,
  RawAttendanceItem,
  AttendanceReportOptions,
} from "./portal-adapter.interface";
import { AttendanceStatusType } from "../attendance/attendance-calculator";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");

const DEFAULT_PORTAL_URL = "https://sdc-sppap1.svkm.ac.in:50001/irj/portal";
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function cleanSubjectName(raw: string): string {
  let cleaned = raw
    .replace(/(?:T2|P2|T1|P1)\s*(?:MBA\s*Tech|MBATech|ALL)?.*$/i, "")
    .trim();

  if (/Image and Vid/i.test(cleaned)) return "Image and Video Processing";
  if (/Artificial Intellige/i.test(cleaned)) return "Artificial Intelligence";
  if (/Mobile Application/i.test(cleaned)) return "Mobile Application Development";
  if (/AI Recept/i.test(cleaned)) return "AI Reception & Software Development";
  if (/Fundamentals of Climate/i.test(cleaned)) return "Fundamentals of Climate Change";
  if (/Management Through Movies/i.test(cleaned)) return "Management Through Movies";
  if (/Operating Systems/i.test(cleaned)) return "Operating Systems";
  if (/Software Engineering/i.test(cleaned)) return "Software Engineering";

  return cleaned || raw.trim();
}

export class PlaywrightPortalAdapter implements IPortalAdapter {
  readonly adapterName = "PLAYWRIGHT_SAP_PROVIDER";
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors"],
      });
    }
    return this.browser;
  }

  private async createContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
      userAgent: CHROME_USER_AGENT,
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
  }

  /**
   * Tests authentication against the SVKM SAP portal.
   */
  async testConnection(credentials: PortalCredentials): Promise<ConnectionTestResult> {
    const portalUrl = credentials.portalUrl || DEFAULT_PORTAL_URL;
    let context: BrowserContext | null = null;

    try {
      const browser = await this.getBrowser();
      context = await this.createContext(browser);
      const page = await context.newPage();

      await page.goto(portalUrl, { waitUntil: "commit", timeout: 35000 });
      const userField = page.locator("#logonuidfield");
      await userField.waitFor({ state: "visible", timeout: 20000 });

      if (!credentials.password) {
        return {
          success: false,
          message: "Password is required for connection testing",
        };
      }

      await page.waitForFunction(
        () => typeof (window as unknown as { code?: string }).code === "string" && (window as unknown as { code?: string }).code!.length > 0,
        { timeout: 10000 }
      );

      const captchaCode = await page.evaluate(() => {
        const win = window as unknown as { code?: string };
        return typeof win.code === "string" ? win.code : "";
      });

      await userField.fill(credentials.username);
      await page.fill("#logonpassfield", credentials.password);
      if (captchaCode) {
        await page.fill("#txtInput", captchaCode);
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: "commit", timeout: 30000 }).catch(() => null),
        page.evaluate(() => {
          const form = (document as unknown as { logonForm?: HTMLFormElement }).logonForm;
          if (form) form.submit();
          else document.getElementById("Button1")?.click();
        }),
      ]);

      await page.waitForTimeout(4000);

      const pageContent = await page.content();
      if (
        pageContent.includes("User authentication failed") ||
        pageContent.includes("Logon failed") ||
        pageContent.includes("Invalid username or password")
      ) {
        return {
          success: false,
          message: "Invalid student credentials entered on portal",
        };
      }

      const cookies = await context.cookies();
      const hasSapSession = cookies.some(
        (c) => c.name.includes("MYSAPSSO2") || c.name.includes("JSESSIONID") || c.name.includes("PortalAlias")
      );

      // Check student welcome name if present
      const welcomeName = await page.evaluate(() => {
        const el = document.getElementById("welcome_message") || document.querySelector(".prtlHdrWelcome");
        if (el) {
          return (el as HTMLElement).innerText.replace(/^Welcome\s*/i, "").trim();
        }
        return "";
      });

      return {
        success: hasSapSession,
        message: hasSapSession
          ? "Authentication successful with SVKM SAP Portal"
          : "Login submitted, awaiting confirmation",
        studentName: welcomeName || undefined,
        studentId: credentials.username,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Portal connection error: ${errorMsg}`,
      };
    } finally {
      if (context) {
        await context.close().catch(() => null);
      }
    }
  }

  /**
   * Fetches attendance report from the SAP portal.
   */
  async fetchAttendance(
    credentials: PortalCredentials,
    dateRange: DateRange,
    options?: AttendanceReportOptions
  ): Promise<RawAttendanceReport> {
    const portalUrl = credentials.portalUrl || DEFAULT_PORTAL_URL;
    let context: BrowserContext | null = null;

    try {
      const browser = await this.getBrowser();
      context = await this.createContext(browser);
      const page = await context.newPage();

      // 1. Login
      await page.goto(portalUrl, { waitUntil: "commit", timeout: 35000 });
      await page.waitForSelector("#logonuidfield", { timeout: 25000 });
      await page.waitForFunction(
        () => typeof (window as unknown as { code?: string }).code === "string" && (window as unknown as { code?: string }).code!.length > 0,
        { timeout: 12000 }
      );

      const captchaCode = await page.evaluate(() => {
        const win = window as unknown as { code?: string };
        return typeof win.code === "string" ? win.code : "";
      });

      await page.fill("#logonuidfield", credentials.username);
      await page.fill("#logonpassfield", credentials.password || "");
      if (captchaCode) {
        await page.fill("#txtInput", captchaCode);
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: "commit", timeout: 30000 }).catch(() => null),
        page.evaluate(() => {
          const form = (document as unknown as { logonForm?: HTMLFormElement }).logonForm;
          if (form) form.submit();
          else document.getElementById("Button1")?.click();
        }),
      ]);

      await page.waitForTimeout(5000);

      // Check student name from header
      const studentName = await page.evaluate(() => {
        const el = document.getElementById("welcome_message") || document.querySelector(".prtlHdrWelcome");
        return el ? (el as HTMLElement).innerText.replace(/^Welcome\s*/i, "").trim() : "";
      });

      // 2. Click Attendance Display for Students tab
      const attendanceNav = page.locator("#navNodeAnchor_1_4, a:has-text('Attendance Display for Students')");
      await attendanceNav.first().waitFor({ state: "visible", timeout: 20000 });
      await attendanceNav.first().click();

      // 3. Locate WebDynpro isolatedWorkArea frame
      let reportFrame = null;
      for (let attempt = 0; attempt < 25; attempt++) {
        await page.waitForTimeout(1000);
        const frames = page.frames();
        for (const f of frames) {
          try {
            const text = await f.evaluate(() => document.body?.innerText || "");
            if (text.includes("Student's Attendance Report")) {
              reportFrame = f;
              break;
            }
          } catch {
            // Ignore frame cross-origin evaluation errors
          }
        }
        if (reportFrame) break;
      }

      if (!reportFrame) {
        throw new Error("Could not find SAP Attendance Report form frame within portal.");
      }

      // 4. Select Academic Year (WD2B)
      await reportFrame.click("#WD2B");
      await page.waitForTimeout(400);

      const reqYear = options?.academicYear || "2026-2027";
      const yearSelected = await reportFrame.evaluate((targetYear) => {
        const items = Array.from(document.querySelectorAll("#WD2C .lsListbox__item, #WD2C [role=option]"));
        const match = items.find((i) => (i as HTMLElement).innerText?.includes(targetYear));
        const item = (match || items[items.length - 1]) as HTMLElement;
        if (item) {
          item.click();
          return item.innerText?.trim();
        }
        return null;
      }, reqYear);
      await page.waitForTimeout(2500);

      // 5. Select Trimester / Semester (WD34)
      await reportFrame.click("#WD34");
      await page.waitForTimeout(400);
      const reqSem = options?.semester || "Semester V";
      await reportFrame.evaluate((targetSem) => {
        const items = Array.from(document.querySelectorAll("#WD35 .lsListbox__item, #WD35 [role=option]"));
        const match = items.find((i) =>
          (i as HTMLElement).innerText?.toLowerCase().includes(targetSem.toLowerCase())
        );
        const target = (match || items[items.length - 1]) as HTMLElement;
        if (target) {
          target.click();
        }
      }, reqSem);
      await page.waitForTimeout(2500);

      // 6. Select Detail Report (WD3A)
      await reportFrame.click("#WD3A");
      await page.waitForTimeout(400);
      const reqReportType = options?.reportType || "Detail Report";
      await reportFrame.evaluate((targetType) => {
        const items = Array.from(document.querySelectorAll("#WD3B .lsListbox__item, #WD3B [role=option]"));
        const match = items.find((i) =>
          (i as HTMLElement).innerText?.toLowerCase().includes(targetType.toLowerCase())
        );
        const detailItem = (match || items[items.length - 1]) as HTMLElement;
        if (detailItem) {
          detailItem.click();
        }
      }, reqReportType);
      await page.waitForTimeout(2000);

      // 7. Fill Start Date & End Date
      const formatDate = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
      };

      const startDateStr = options?.startDate || formatDate(dateRange.startDate);
      const endDateStr = options?.endDate || formatDate(dateRange.endDate);

      await reportFrame.fill("#WD47", startDateStr);
      await reportFrame.fill("#WD4C", endDateStr);
      await reportFrame.press("#WD4C", "Tab");
      await page.waitForTimeout(1000);

      // 8. Click SUBMIT
      const submitBtn = reportFrame.locator("text='SUBMIT'");
      await submitBtn.click();

      // 9. Extract PDF download URL from LightSpeed lsdata attribute
      let pdfUrl: string | null = null;
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1000);
        pdfUrl = await reportFrame.evaluate(() => {
          const els = Array.from(document.querySelectorAll("[lsdata], object, embed, a"));
          for (const el of els) {
            const lsdata = el.getAttribute("lsdata") || "";
            if (lsdata.includes(".pdf")) {
              try {
                const parsed = JSON.parse(lsdata);
                return parsed["0"] || parsed["src"] || null;
              } catch {
                const match = lsdata.match(/(\/sap\/bc\/webdynpro\/[^\s"']+\.pdf[^\s"']*)/);
                if (match) return match[1];
              }
            }
            const src = el.getAttribute("src") || el.getAttribute("data") || el.getAttribute("href") || "";
            if (src.includes(".pdf")) return src;
          }
          return null;
        });

        if (pdfUrl) break;
      }

      if (!pdfUrl) {
        throw new Error("SAP Portal did not generate attendance PDF within 25 seconds.");
      }

      const fullPdfUrl = new URL(pdfUrl, "https://sdcwdapp.svkm.ac.in").toString();
      const pdfResponse = await context.request.get(fullPdfUrl);
      if (!pdfResponse.ok()) {
        throw new Error(`Failed to download attendance PDF from SAP server (HTTP ${pdfResponse.status()}).`);
      }

      const pdfBuffer = await pdfResponse.body();

      // 10. Parse PDF records
      const parsedPdf = await pdfParse(pdfBuffer);
      const fullText = parsedPdf.text || "";

      const items: RawAttendanceItem[] = [];
      const datePattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/g;
      let dateMatch: RegExpExecArray | null;
      const datePositions: { date: string; index: number }[] = [];

      while ((dateMatch = datePattern.exec(fullText)) !== null) {
        datePositions.push({ date: dateMatch[1], index: dateMatch.index });
      }

      for (let i = 0; i < datePositions.length; i++) {
        const cur = datePositions[i];
        const prevIndex = i === 0 ? 0 : datePositions[i - 1].index + datePositions[i - 1].date.length;
        const nextIndex = i < datePositions.length - 1 ? datePositions[i + 1].index : fullText.length;

        const beforeText = fullText.substring(prevIndex, cur.index);
        const afterText = fullText.substring(cur.index + cur.date.length, nextIndex);

        const matchCourse = beforeText.match(/(?:^|\n)\s*(\d+)\s*(?:\r?\n|\t)\s*([^\r\n\t]+?)\s*$/);
        const rawCourse = matchCourse ? matchCourse[2].trim() : "Unknown Course";
        const subjectName = cleanSubjectName(rawCourse);

        const matchStatus = afterText.match(/(?:AM|PM)\s*\n\s*([PAEL]|NU)\b/) || afterText.match(/\b([PAEL]|NU)\b/);
        const statusLetter = matchStatus ? matchStatus[1].toUpperCase() : "P";

        items.push({
          date: cur.date,
          subjectName,
          status: statusLetter,
        });
      }

      return {
        fetchedAt: new Date(),
        source: "SVKM_SAP_PORTAL",
        studentName: studentName || undefined,
        studentId: credentials.username,
        term: yearSelected || undefined,
        items,
      };
    } finally {
      if (context) {
        await context.close().catch(() => null);
      }
    }
  }

  async parseReport(rawReport: RawAttendanceReport): Promise<NormalizedAttendanceRecord[]> {
    // Track periodNumber sequentially for records of the same subject on the same day
    const periodTracker = new Map<string, number>();

    return rawReport.items.map((item) => {
      let status: AttendanceStatusType = "UNKNOWN";
      const normalizedStatusStr = item.status.trim().toUpperCase();

      if (normalizedStatusStr === "P" || normalizedStatusStr === "PRESENT" || normalizedStatusStr === "L") {
        status = "PRESENT";
      } else if (normalizedStatusStr === "A" || normalizedStatusStr === "ABSENT") {
        status = "ABSENT";
      } else if (normalizedStatusStr === "E" || normalizedStatusStr.includes("DUTY") || normalizedStatusStr === "OD") {
        status = "ON_DUTY";
      } else if (normalizedStatusStr.includes("MED") || normalizedStatusStr === "ML") {
        status = "MEDICAL_LEAVE";
      } else if (normalizedStatusStr.includes("CANCEL") || normalizedStatusStr === "NU") {
        status = "CANCELLED";
      }

      const attendanceDate = new Date(item.date);
      const dateKey = `${attendanceDate.toISOString().split("T")[0]}_${item.subjectName}`;
      const periodNumber = (periodTracker.get(dateKey) || 0) + 1;
      periodTracker.set(dateKey, periodNumber);

      return {
        attendanceDate,
        subjectName: item.subjectName,
        subjectCode: item.subjectCode,
        periodNumber,
        status,
        source: "PORTAL_SYNC",
        rawStatus: item.status,
      };
    });
  }

  async closeSession(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => null);
      this.browser = null;
    }
  }
}
