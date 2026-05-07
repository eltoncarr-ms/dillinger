import { test, expect, type Locator, type Page } from "@playwright/test";

const seededDocument = {
  id: "pane-resize-doc",
  title: "Pane Resize.md",
  body: "# Pane Resize\n\nThis document verifies resizing and focus mode behavior.",
  createdAt: "2026-03-10T00:00:00.000Z",
};

const defaultProfile = {
  enableAutoSave: true,
  enableWordsCount: true,
  enableCharactersCount: true,
  enableScrollSync: true,
  tabSize: 4,
  keybindings: "default",
  enableNightMode: false,
  enableGitHubComment: true,
};

type Profile = typeof defaultProfile & {
  panelLayout?: "split" | "editor-only" | "preview-only";
  splitRatio?: number;
};

function seedSingleDocument(page: Page, profile: Profile = defaultProfile) {
  return page.addInitScript(
    ({ doc, profileState }) => {
      if (window.localStorage.getItem("files")) return;
      window.localStorage.setItem("files", JSON.stringify([doc]));
      window.localStorage.setItem("currentDocument", JSON.stringify(doc));
      window.localStorage.setItem("profileV3", JSON.stringify(profileState));
    },
    { doc: seededDocument, profileState: profile }
  );
}

function editorPane(page: Page) {
  return page.getByTestId("editor-pane");
}

function previewPane(page: Page) {
  return page.getByTestId("preview-pane");
}

function paneResizer(page: Page) {
  return page.getByRole("separator", { name: "Resize editor and preview panes" });
}

async function getVisibleBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function getPaneWidths(page: Page) {
  const editorBox = await getVisibleBox(editorPane(page));
  const previewBox = await getVisibleBox(previewPane(page));
  const total = editorBox.width + previewBox.width;

  return {
    editorWidth: editorBox.width,
    previewWidth: previewBox.width,
    total,
    editorRatio: editorBox.width / total,
  };
}

async function getProfile(page: Page): Promise<Profile> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("profileV3") || "{}"));
}

async function waitForPanelLayout(
  page: Page,
  panelLayout: "split" | "editor-only" | "preview-only"
) {
  await expect.poll(async () => (await getProfile(page)).panelLayout).toBe(panelLayout);
}

async function waitForStoredSplitRatio(page: Page, splitRatio: number) {
  await expect
    .poll(async () => (await getProfile(page)).splitRatio ?? Number.NaN)
    .toBeCloseTo(splitRatio, 1);
}

async function waitForEditorReady(page: Page) {
  await expect(
    page.getByRole("heading", { level: 2, name: seededDocument.title })
  ).toBeVisible();
  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 10_000 });
  await expect(previewPane(page)).toBeVisible();
  await expect(page.locator("#preview h1")).toHaveText("Pane Resize", {
    timeout: 10_000,
  });
}

async function loadEditor(page: Page) {
  await page.goto("/");
  await waitForEditorReady(page);
}

async function dragResizerBy(page: Page, deltaX: number) {
  const resizerBox = await getVisibleBox(paneResizer(page));
  const startX = resizerBox.x + resizerBox.width / 2;
  const y = resizerBox.y + resizerBox.height / 2;

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, y, { steps: 10 });
  await page.mouse.up();
}

async function widenEditorPane(page: Page) {
  const startingWidths = await getPaneWidths(page);
  await dragResizerBy(page, startingWidths.total * 0.2);

  const resizedWidths = await getPaneWidths(page);
  expect(resizedWidths.editorRatio).toBeGreaterThan(0.6);
  await waitForStoredSplitRatio(page, resizedWidths.editorRatio);

  return resizedWidths;
}

async function countVisiblePanes(page: Page) {
  const panes = [editorPane(page), previewPane(page)];
  let visibleCount = 0;

  for (const pane of panes) {
    if (await pane.isVisible()) visibleCount += 1;
  }

  return visibleCount;
}

test.describe("Pane resize and focus mode", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedSingleDocument(page);
  });

  test("defaults to an even editor and preview split", async ({ page }) => {
    await loadEditor(page);

    const { editorRatio } = await getPaneWidths(page);

    expect(Math.abs(editorRatio - 0.5)).toBeLessThan(0.02);
  });

  test("resizes panes by dragging the separator and persists the split ratio", async ({ page }) => {
    await loadEditor(page);

    const { editorRatio } = await widenEditorPane(page);
    const profile = await getProfile(page);

    expect(profile.splitRatio).toBeCloseTo(editorRatio, 1);
  });

  test("clamps the persisted split ratio at the maximum when dragged past the edge", async ({
    page,
  }) => {
    await loadEditor(page);

    const resizerBox = await getVisibleBox(paneResizer(page));
    const startX = resizerBox.x + resizerBox.width / 2;
    const y = resizerBox.y + resizerBox.height / 2;
    const viewport = page.viewportSize();

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move((viewport?.width ?? 1280) + 500, y, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(async () => (await getProfile(page)).splitRatio ?? Number.NaN)
      .toBeLessThanOrEqual(0.86);
  });

  test("switches layouts with navbar buttons while preserving the split ratio", async ({
    page,
  }) => {
    await loadEditor(page);
    const resizedWidths = await widenEditorPane(page);
    const savedRatio = resizedWidths.editorRatio;

    const focusEditorButton = page.getByRole("button", { name: "Focus editor" });
    const showBothButton = page.getByRole("button", { name: "Show both panes" });
    const focusPreviewButton = page.getByRole("button", { name: "Focus preview" });

    await focusEditorButton.click();
    await expect(previewPane(page)).toBeHidden();
    await expect(focusEditorButton).toHaveAttribute("aria-pressed", "true");
    await waitForPanelLayout(page, "editor-only");

    const focusedEditorBox = await getVisibleBox(editorPane(page));
    expect(focusedEditorBox.width).toBeGreaterThan(1280 * 0.9);

    await focusPreviewButton.click();
    await expect(previewPane(page)).toBeVisible();
    await expect(editorPane(page)).toBeHidden();
    await expect(focusPreviewButton).toHaveAttribute("aria-pressed", "true");
    await waitForPanelLayout(page, "preview-only");

    await showBothButton.click();
    await expect(editorPane(page)).toBeVisible();
    await expect(previewPane(page)).toBeVisible();
    await expect(showBothButton).toHaveAttribute("aria-pressed", "true");
    await waitForPanelLayout(page, "split");

    const restoredWidths = await getPaneWidths(page);
    expect(restoredWidths.editorRatio).toBeCloseTo(savedRatio, 1);
    await waitForStoredSplitRatio(page, savedRatio);
  });

  test("persists a non-default split ratio across reload", async ({ page }) => {
    await loadEditor(page);
    const beforeReload = await widenEditorPane(page);

    await page.reload();
    await waitForEditorReady(page);

    const afterReload = await getPaneWidths(page);
    expect(Math.abs(afterReload.editorWidth - beforeReload.editorWidth)).toBeLessThan(4);
  });

  test("cycles focus mode with the keyboard shortcut", async ({ page }) => {
    await loadEditor(page);

    const shortcut = process.platform === "darwin" ? "Meta+Backslash" : "Control+Backslash";
    const focusEditorButton = page.getByRole("button", { name: "Focus editor" });
    const showBothButton = page.getByRole("button", { name: "Show both panes" });
    const focusPreviewButton = page.getByRole("button", { name: "Focus preview" });

    await page.keyboard.press(shortcut);
    await expect(focusEditorButton).toHaveAttribute("aria-pressed", "true");
    await expect(previewPane(page)).toBeHidden();
    await waitForPanelLayout(page, "editor-only");

    await page.keyboard.press(shortcut);
    await expect(focusPreviewButton).toHaveAttribute("aria-pressed", "true");
    await expect(editorPane(page)).toBeHidden();
    await waitForPanelLayout(page, "preview-only");

    await page.keyboard.press(shortcut);
    await expect(showBothButton).toHaveAttribute("aria-pressed", "true");
    await expect(editorPane(page)).toBeVisible();
    await expect(previewPane(page)).toBeVisible();
    await waitForPanelLayout(page, "split");
  });
});

test.describe("Pane resize and focus mode on mobile", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedSingleDocument(page);
  });

  test("hides the resizer and shows a single pane on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 2, name: seededDocument.title })
    ).toBeVisible();

    const separator = page.locator(
      '[role="separator"][aria-label="Resize editor and preview panes"]'
    );
    await expect
      .poll(async () => {
        const count = await separator.count();
        if (count === 0) return "absent";
        return (await separator.first().getAttribute("aria-hidden")) === "true"
          ? "hidden"
          : "visible";
      })
      .not.toBe("visible");

    await expect.poll(async () => countVisiblePanes(page)).toBe(1);
  });
});
