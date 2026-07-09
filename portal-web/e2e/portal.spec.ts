import { test, expect } from '@playwright/test';

test.describe('Archi Portal E2E Tests', () => {
  test('should render portal dashboard and navigate between views', async ({ page }) => {
    // Navigate to local server homepage
    await page.goto('/');

    // Verify dashboard metrics cards and headers are present
    await expect(page.locator('h1')).toContainText('Architecture Actuelle');
    await expect(page.locator('text=Cartographie des Services')).toBeVisible();
    await expect(page.locator('text=Total Services').first()).toBeVisible();
    await expect(page.locator('text=Namespaces').first()).toBeVisible();

    // Verify presence of direct PDF exporter action
    const pdfButton = page.locator('button[title="Télécharger cette vue sous forme de document PDF"]');
    await expect(pdfButton).toBeVisible();

    // Click and navigate to "Architecture des Projets" view
    const projectsTab = page.locator('button:has-text("Architecture des Projets")');
    await expect(projectsTab).toBeVisible();
    await projectsTab.click();

    // Verify project catalog views load successfully and show initial project selection prompt
    await expect(page.locator('text=Veuillez sélectionner un projet pour afficher sa structure documentaire.')).toBeVisible();
  });
});
