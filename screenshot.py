import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Open the local development server
        await page.goto('http://localhost:5173')

        # Wait for the app to load
        await page.wait_for_selector('.welcome-card')

        # Click the "New Project" or similar to open the canvas
        new_project_btn = await page.query_selector('.welcome-btn.primary')
        if new_project_btn:
             await new_project_btn.click()
             await asyncio.sleep(1) # wait for new project dialog

             # Create new project
             create_btn = await page.wait_for_selector('.btn-primary')
             await create_btn.click()
             await asyncio.sleep(1) # wait for canvas

        # Open the Export dialog. We need to trigger this.
        # Evaluate script to open export dialog using Zustand store
        await page.evaluate('window._useStore.getState().setIsExportDialogOpen(true)')
        await asyncio.sleep(1) # wait for dialog animation

        # Take a screenshot of the desktop version
        await page.screenshot(path='export_desktop.png')

        # Change viewport to mobile
        await page.set_viewport_size({"width": 375, "height": 812})
        await asyncio.sleep(1) # wait for responsive adjustments

        # Take a screenshot of the mobile version
        await page.screenshot(path='export_mobile.png')

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
