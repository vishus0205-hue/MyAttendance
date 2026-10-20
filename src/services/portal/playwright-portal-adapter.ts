import { chromium, Browser, BrowserContext } from "playwright";
import {
  IPortalAdapter,
  PortalCredentials,
  ConnectionTestResult,
  DateRange,
  RawAttendanceReport,
  NormalizedAttendanceRecord,
  AttendanceReportOptions,
} from "./portal-adapter.interface";
import { AttendanceStatusType } from "../attendance/attendance-calculator";
import { parsePdfAttendanceItems } from "./pdf-attendance-parser";
import { classifyPortalLogin } from "./portal-login-result";

const pdfParse = require("pdf-parse");

const DEFAULT_PORTAL_URL = "https://sdc-sppap1.svkm.ac.in:50001/irj/portal";
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export class PlaywrightPortalAdapter implements IPortalAdapter {
  readonly adapterName = "PLAYWRIGHT_SAP_PROVIDER";
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const serverless = process.env.VERCEL === "1";
      const serverlessChromium = serverless ? (await import("@sparticuz/chromium")).default : null;
      this.browser = await chromium.launch({
        headless: true,
        ...(serverlessChromium ? { executablePath: await serverlessChromium.executablePath() } : {}),
        args: [
          ...(serverlessChromium ? serverlessChromium.args : []),
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--ignore-certificate-errors",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-extensions",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
        ],
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
      // Normalize username: extract raw SAP ID if college email was provided (e.g. 70472400419@svkm.ac.in -> 70472400419)
      const cleanUsername = (credentials.username || "")
        .replace(/@svkm\.ac\.in$/i, "")
        .trim();

      if (!cleanUsername) {
        return {
          success: false,
          message: "Student SAP ID is required for authentication.",
        };
      }

      if (!credentials.password) {
        return {
          success: false,
          message: "Portal password is required for authentication.",
        };
      }

      const browser = await this.getBrowser();
      context = await this.createContext(browser);
      const page = await context.newPage();

      await page.goto(portalUrl, { waitUntil: "commit", timeout: 35000 });
      const userField = page.locator("#logonuidfield");
      await userField.waitFor({ state: "visible", timeout: 20000 });

      await page.waitForFunction(
        () => typeof (window as unknown as { code?: string }).code === "string" && (window as unknown as { code?: string }).code!.length > 0,
        undefined,
        { timeout: 10000 }
      ).catch(() => null);

      const captchaCode = await page.evaluate(() => {
        const win = window as unknown as { code?: string };
        return typeof win.code === "string" ? win.code : "";
      });

      if (await page.locator("#txtInput").isVisible().catch(() => false) && !captchaCode) {
        return {
          success: false,
          errorCode: "VERIFICATION_UNAVAILABLE",
          message: "The SVKM portal challenge could not be completed automatically. Please try again shortly.",
        };
      }

      await userField.fill(cleanUsername);
      await page.fill("#logonpassfield", credentials.password);
      if (captchaCode) {
        await page.fill("#txtInput", captchaCode);
      }

      // Click the portal's button so its own captcha and form handlers run.
      const submitButton = page.locator("#Button1, button[type='submit'], input[type='submit']").first();
      if (await submitButton.count()) {
        await submitButton.click({ timeout: 15000 });
      } else {
        await page.locator("#logonpassfield").press("Enter");
      }

      // Wait for post-login indicators (welcome header, navigation, session conflict modal, or error text)
      await page.waitForSelector(
        "#navNode_1_4, #welcome_message, .prtlHdrWelcome, .urTxtError, #logonErrorText, input[value*='Continue'], button:has-text('Continue'), #button_continue",
        { timeout: 15000 }
      ).catch(() => null);

      await page.waitForTimeout(1000);

      // Handle session conflict modal if user is logged into SAP portal in another tab/browser
      const continueBtn = page.locator(
        "input[value*='Continue'], button:has-text('Continue'), input[name*='terminate'], #button_continue"
      );
      if ((await continueBtn.count()) > 0) {
        await continueBtn.first().click().catch(() => null);
        await page.waitForTimeout(1500);
      }

      const visibleErrorText = (await page.locator(".urTxtError:visible, #logonErrorText:visible").allInnerTexts()).join(" ");

      // Check student welcome name if present
      const welcomeName = await page.evaluate(() => {
        const el = document.getElementById("welcome_message") || document.querySelector(".prtlHdrWelcome");
        if (el) {
          return (el as HTMLElement).innerText.replace(/^Welcome\s*/i, "").trim();
        }
        return "";
      });

      const hasAttendanceTab = await page.locator("#navNode_1_4, td:has-text('Attendance Display for Students')").first().isVisible().catch(() => false);
      return {
        ...classifyPortalLogin(visibleErrorText, Boolean(welcomeName) || hasAttendanceTab, welcomeName || undefined),
        studentId: cleanUsername,
      };
    } catch (err: unknown) {
      console.error("Portal login verification failed:", err);
      return {
        success: false,
        errorCode: "VERIFICATION_UNAVAILABLE",
        message: "Portal login verification is temporarily unavailable. Please try again later.",
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
      await page.goto(portalUrl, { waitUntil: "commit", timeout: 45000 });
      await page.waitForSelector("#logonuidfield", { timeout: 30000 });
      await page.waitForFunction(
        () => typeof (window as unknown as { code?: string }).code === "string" && (window as unknown as { code?: string }).code!.length > 0,
        undefined,
        { timeout: 15000 }
      ).catch(() => null);

      const captchaCode = await page.evaluate(() => {
        const win = window as unknown as { code?: string };
        return typeof win.code === "string" ? win.code : "";
      });

      const cleanUsername = (credentials.username || "")
        .replace(/@svkm\.ac\.in$/i, "")
        .trim();

      await page.fill("#logonuidfield", cleanUsername);
      await page.fill("#logonpassfield", credentials.password || "");
      if (captchaCode) {
        await page.fill("#txtInput", captchaCode);
      }

      const submitButton = page.locator("#Button1, button[type='submit'], input[type='submit']").first();
      if (await submitButton.count()) {
        await submitButton.click({ timeout: 15000 });
      } else {
        await page.locator("#logonpassfield").press("Enter");
      }

      // Quick wait for post-login indicators
      await page.waitForSelector("#navNode_1_4, #welcome_message, .prtlHdrWelcome, .urTxtError, #logonErrorText", { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(800);

      // Verify portal authentication didn't fail
      const pageContent = await page.content();
      if (
        pageContent.includes("User authentication failed") ||
        pageContent.includes("Logon failed") ||
        pageContent.includes("Invalid username or password") ||
        pageContent.includes("Invalid user name or password") ||
        pageContent.includes("Password has expired")
      ) {
        throw new Error(`Portal login failed for student ${credentials.username}: Invalid credentials or expired password.`);
      }

      // Check if session conflict modal/button is present ("Continue", "Terminate other sessions")
      const continueBtn = page.locator("input[value*='Continue'], button:has-text('Continue'), input[name*='terminate'], #button_continue");
      if ((await continueBtn.count()) > 0) {
        await continueBtn.first().click().catch(() => null);
        await page.waitForTimeout(1000);
      }

      // Check student name from header
      const studentName = await page.evaluate(() => {
        const el = document.getElementById("welcome_message") || document.querySelector(".prtlHdrWelcome");
        return el ? (el as HTMLElement).innerText.replace(/^Welcome\s*/i, "").trim() : "";
      });

      // 2. Click Attendance Display for Students tab
      const attendanceNav = page.locator(
        "#navNode_1_4, #navNodeAnchor_1_4, td:has-text('Attendance Display for Students'), a:has-text('Attendance Display for Students')"
      );
      await attendanceNav.first().waitFor({ state: "visible", timeout: 25000 });
      await attendanceNav.first().click().catch(() => null);

      // Invoke doMouseClick directly as a robust fallback for SAP NetWeaver navigation
      await page.evaluate(() => {
        const win = window as any;
        if (typeof win.doMouseClick === "function") {
          win.doMouseClick(1, 4);
        } else {
          const el = document.getElementById("navNode_1_4") || document.getElementById("navNodeAnchor_1_4");
          el?.click();
        }
      }).catch(() => null);

      // 3. Locate WebDynpro isolatedWorkArea frame with responsive 350ms retry
      let reportFrame = null;
      for (let attempt = 0; attempt < 80; attempt++) {
        await page.waitForTimeout(350);
        const frames = page.frames();
        for (const f of frames) {
          try {
            const url = f.url() || "";
            const name = f.name() || "";

            // Primary: Match by WebDynpro attendance app in URL
            if (url.includes("ZSVKM_STUDENT_ATTENDA") || url.includes("STUDENT_ATTENDANCE")) {
              reportFrame = f;
              break;
            }

            // Secondary: Match by isolatedWorkArea frame name
            if (name === "isolatedWorkArea") {
              const text = await f.evaluate(() => document.body?.innerText || "").catch(() => "");
              if (text.includes("Attendance Report") || text.includes("Student's Attendance Report")) {
                reportFrame = f;
                break;
              }
            }

            // Fallback: Match by body text content
            const text = await f.evaluate(() => document.body?.innerText || "").catch(() => "");
            if (
              text.toLowerCase().includes("student's attendance report") ||
              text.toLowerCase().includes("attendance report")
            ) {
              reportFrame = f;
              break;
            }
          } catch {
            // Ignore frame navigation and cross-origin evaluation errors during load
          }
        }
        if (reportFrame) break;

        // If not found after ~10 or 20 seconds, re-trigger navigation in case SAP event was dropped
        if (attempt === 30 || attempt === 60) {
          await page.evaluate(() => {
            const win = window as any;
            if (typeof win.doMouseClick === "function") {
              win.doMouseClick(1, 4);
            }
          }).catch(() => null);
        }
      }

      if (!reportFrame) {
        throw new Error("Could not find SAP Attendance Report form frame within portal.");
      }

      // Check whether SAP Portal is restricting attendance display due to operating hours
      const frameNotice = await reportFrame.evaluate(() => document.body?.innerText || "").catch(() => "");
      if (
        frameNotice.includes("between 06:00 PM to 07:00 AM") ||
        frameNotice.includes("06:00 PM to 07:00 AM") ||
        frameNotice.includes("between 18:00 to 07:00")
      ) {
        throw new Error(
          "PORTAL_HOURS_RESTRICTED: SVKM SAP Portal permits attendance queries only between 06:00 PM and 07:00 AM IST. Portal is currently restricted for daytime university hours."
        );
      }

      // 4. Select Academic Year (WD2B)
      await reportFrame.waitForSelector("#WD2B", { timeout: 25000 });
      await reportFrame.click("#WD2B");
      await page.waitForTimeout(300);

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
      await page.waitForTimeout(800);

      // 5. Select Trimester / Semester (WD34)
      await reportFrame.waitForSelector("#WD34", { timeout: 15000 });
      await reportFrame.click("#WD34");
      await page.waitForTimeout(300);
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
      await page.waitForTimeout(800);

      // 6. Select Detail Report (WD3A)
      await reportFrame.waitForSelector("#WD3A", { timeout: 15000 });
      await reportFrame.click("#WD3A");
      await page.waitForTimeout(300);
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
      
      // Wait for date inputs to become visible
      await reportFrame.waitForSelector("#WD47", { timeout: 15000 });
      await page.waitForTimeout(300);

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
      await page.waitForTimeout(300);

      // 8. Click SUBMIT
      const submitBtn = reportFrame.locator("#WD52").or(reportFrame.getByText("SUBMIT", { exact: true }));
      await submitBtn.first().click();
      await reportFrame.evaluate(() => {
        const btn = document.getElementById("WD52") || document.getElementById("WD52-caption");
        if (btn) (btn as HTMLElement).click();
      }).catch(() => null);

      // 9. Extract PDF download URL from LightSpeed lsdata attribute (responsive 350ms poll)
      let pdfUrl: string | null = null;
      for (let i = 0; i < 75; i++) {
        await page.waitForTimeout(350);
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
        throw new Error("SAP Portal did not generate attendance PDF within 28 seconds.");
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

      const items = parsePdfAttendanceItems(fullText);

      let resolvedStudentName = studentName;
      if (!resolvedStudentName) {
        const nameMatch = fullText.match(/(?:Student\s*Name|Name\s*of\s*the\s*Student|Name\s*of\s*Student|Student)\s*[:\-]\s*([A-Za-z\s.]+?)(?:\r?\n|\t|Roll|SAP|Student\s*No|Student\s*Id|Registration|Program|Semester|$)/i);
        if (nameMatch && nameMatch[1].trim().length > 2) {
          resolvedStudentName = nameMatch[1].trim();
        }
      }

      return {
        fetchedAt: new Date(),
        source: "SVKM_SAP_PORTAL",
        studentName: resolvedStudentName || undefined,
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
