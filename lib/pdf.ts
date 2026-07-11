import fs from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { renderHtmlDocument } from "@/lib/export";
import { renderMarkdown } from "@/lib/markdown";

const PDF_OPTIONS = {
  format: "A4" as const,
  margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
  printBackground: true,
};

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 720,
};

const WINDOWS_PROGRAM_FILES = process.env["ProgramFiles"] || "C:\\Program Files";
const WINDOWS_PROGRAM_FILES_X86 =
  process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
const WINDOWS_LOCAL_APP_DATA =
  process.env.LOCALAPPDATA || "C:\\Users\\Default\\AppData\\Local";

const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/microsoft-edge",
  // Windows - Chrome
  `${WINDOWS_PROGRAM_FILES}\\Google\\Chrome\\Application\\chrome.exe`,
  `${WINDOWS_PROGRAM_FILES_X86}\\Google\\Chrome\\Application\\chrome.exe`,
  `${WINDOWS_LOCAL_APP_DATA}\\Google\\Chrome\\Application\\chrome.exe`,
  // Windows - Edge (Chromium-based)
  `${WINDOWS_PROGRAM_FILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${WINDOWS_PROGRAM_FILES_X86}\\Microsoft\\Edge\\Application\\msedge.exe`,
].filter((candidate): candidate is string => Boolean(candidate));

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_EXECUTION_ENV);
}

function isContainerRuntime() {
  return process.env.DILLINGER_CONTAINER === "true";
}

async function resolveChromeExecutablePath() {
  if (isServerlessRuntime()) {
    const executablePath = await chromium.executablePath();

    if (!executablePath) {
      throw new Error("No Chromium executable available for PDF export");
    }

    return executablePath;
  }

  for (const candidate of LOCAL_CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Chrome executable not found. Set PUPPETEER_EXECUTABLE_PATH for local PDF export."
  );
}

function getLaunchOptions(executablePath: string) {
  if (isServerlessRuntime()) {
    return {
      args: puppeteer.defaultArgs({
        args: chromium.args,
        headless: "shell",
      }),
      defaultViewport: DEFAULT_VIEWPORT,
      executablePath,
      headless: "shell" as const,
    };
  }

  return {
    args: isContainerRuntime()
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : undefined,
    defaultViewport: DEFAULT_VIEWPORT,
    executablePath,
    headless: true,
  };
}

export async function renderPdfBuffer({
  markdown,
  title,
}: {
  markdown: string;
  title?: string;
}) {
  const renderedMarkdown = await renderMarkdown(markdown);
  const html = renderHtmlDocument({
    title,
    html: renderedMarkdown,
    styled: true,
    forPrint: true,
  });

  const executablePath = await resolveChromeExecutablePath();
  const browser = await puppeteer.launch(getLaunchOptions(executablePath));

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");
    const pdf = await page.pdf(PDF_OPTIONS);

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
