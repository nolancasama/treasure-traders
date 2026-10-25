import { defineConfig, devices } from "@playwright/test";

// Screenshot passes for visual review (not assertions). Each slice adds its own
// tests/shots/<name>.spec.ts and writes PNGs under .tmp/shots/<name>/.
export default defineConfig({
  testDir: "./tests/shots",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  reporter: "line",
  outputDir: ".tmp/shots-results",
  use: {
    baseURL: "http://127.0.0.1:4184",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    }
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4184 --strictPort",
    url: "http://127.0.0.1:4184",
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    {
      name: "chromebook",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }
    }
  ]
});
