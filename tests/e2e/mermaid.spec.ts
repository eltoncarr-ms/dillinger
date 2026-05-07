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
