import { test, expect } from "@playwright/test";

const seededDocument = {
  id: "mermaid-test-doc",
  title: "Mermaid Test.md",
  body: "```mermaid\nflowchart TD\nA-->B\n```",
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

function seedMermaidDocument(page: import("@playwright/test").Page) {
  return page.addInitScript(
    ({ doc, profile }) => {
      window.localStorage.setItem("files", JSON.stringify([doc]));
      window.localStorage.setItem("currentDocument", JSON.stringify(doc));
      window.localStorage.setItem("profileV3", JSON.stringify(profile));
    },
    { doc: seededDocument, profile: defaultProfile }
  );
}

test.beforeEach(async ({ page }) => {
  await seedMermaidDocument(page);
});

test("renders a mermaid diagram in the preview pane", async ({ page }) => {
  await page.goto("/");

  const previewPane = page.getByTestId("preview-pane");
  await expect(previewPane).toBeVisible();

  // Verifies: Mermaid fenced code blocks render through the real browser pipeline.
  await expect(
    page.locator('[data-testid="preview-pane"] pre.mermaid svg')
  ).toBeVisible({ timeout: 15_000 });
});

test("mermaid diagram persists after switching panel layouts", async ({ page }) => {
  await page.goto("/");
  const svg = page.locator('[data-testid="preview-pane"] pre.mermaid svg');
  await expect(svg).toBeVisible({ timeout: 15_000 });

  // Switch to preview-only, then back to split. Regression for the case where
  // the diagram disappeared after a re-render because dangerouslySetInnerHTML
  // re-applied the cached HTML and wiped out the injected SVG.
  await page.getByRole("button", { name: "Focus preview", exact: true }).click();
  await expect(svg).toBeVisible({ timeout: 5_000 });

  await page.getByRole("button", { name: "Show both panes", exact: true }).click();
  await expect(svg).toBeVisible({ timeout: 5_000 });

  await page.getByRole("button", { name: "Focus editor", exact: true }).click();
  await page.getByRole("button", { name: "Show both panes", exact: true }).click();
  await expect(svg).toBeVisible({ timeout: 5_000 });
});
