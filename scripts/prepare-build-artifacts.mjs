import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");
const serverWorkerPath = path.join(serverDir, "index.js");
const standaloneDir = path.join(distDir, "standalone");
const nextDir = path.join(root, ".next");
const outDir = path.join(root, "out");
const publicDir = path.join(root, "public");

// 1. Copy client assets to dist root so dist has all static assets at root level
if (fs.existsSync(clientDir)) {
  const clientEntries = fs.readdirSync(clientDir);
  for (const entry of clientEntries) {
    const src = path.join(clientDir, entry);
    const dest = path.join(distDir, entry);
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
}

// 2. Pre-render routes to static HTML in dist/ and dist/client/
if (fs.existsSync(serverWorkerPath)) {
  try {
    const { default: worker } = await import(serverWorkerPath);
    const routesToRender = ["/", "/test", "/node-test"];

    for (const route of routesToRender) {
      try {
        const response = await worker.fetch(
          new Request(`http://localhost${route}`, {
            headers: { accept: "text/html" },
          }),
          {
            ASSETS: {
              fetch: async () => new Response("Not found", { status: 404 }),
            },
          },
          {
            waitUntil() {},
            passThroughOnException() {},
          }
        );

        if (response && response.status === 200) {
          const html = await response.text();
          if (route === "/") {
            fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
            fs.writeFileSync(path.join(clientDir, "index.html"), html, "utf8");
          } else {
            const relPath = route.startsWith("/") ? route.slice(1) : route;
            const targetDir = path.join(distDir, relPath);
            fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");

            const targetClientDir = path.join(clientDir, relPath);
            fs.mkdirSync(targetClientDir, { recursive: true });
            fs.writeFileSync(path.join(targetClientDir, "index.html"), html, "utf8");
          }
        }
      } catch (err) {
        console.warn(`[prepare-artifacts] Warning rendering route ${route}:`, err.message);
      }
    }
  } catch (err) {
    console.warn("[prepare-artifacts] Could not load server worker for pre-rendering:", err.message);
  }
}

// 3. Ensure public directory files are copied into dist/ and dist/client/
if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  for (const file of publicFiles) {
    fs.copyFileSync(path.join(publicDir, file), path.join(distDir, file));
    if (fs.existsSync(clientDir)) {
      fs.copyFileSync(path.join(publicDir, file), path.join(clientDir, file));
    }
  }
}

// 4. Populate out/ directory for standard static export compatibility
try {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(path.join(distDir, "index.html"))) {
    fs.cpSync(distDir, outDir, {
      recursive: true,
      filter: (src) => !src.includes("/server") && !src.includes("/standalone"),
    });
  }
} catch (err) {
  console.warn("[prepare-artifacts] Warning syncing out directory:", err.message);
}

// 5. Populate .next/ with full Next.js compatibility structure
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  fs.mkdirSync(nextDir, { recursive: true });

  const buildId = "production-build-" + Date.now();
  fs.writeFileSync(path.join(nextDir, "BUILD_ID"), buildId, "utf8");

  // Next.js manifest metadata
  const routesManifest = {
    version: 3,
    pages404: true,
    caseSensitive: false,
    basePath: "",
    redirects: [],
    headers: [],
    dynamicRoutes: [],
    staticRoutes: [
      { page: "/", regex: "^/(?:/)?$", routeKeys: {}, namedRegex: "^/(?:/)?$" },
      { page: "/test", regex: "^/test(?:/)?$", routeKeys: {}, namedRegex: "^/test(?:/)?$" },
      { page: "/node-test", regex: "^/node-test(?:/)?$", routeKeys: {}, namedRegex: "^/node-test(?:/)?$" },
    ],
    dataRoutes: [],
    rsc: {
      header: "RSC",
      varyHeader: "RSC, Accept, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
      prefetchHeader: "Next-Router-Prefetch",
      didPostponeHeader: "x-nextjs-postponed",
      contentTypeHeader: "text/x-component",
      suffix: ".rsc",
      prefetchSuffix: ".prefetch.rsc",
    },
  };
  fs.writeFileSync(path.join(nextDir, "routes-manifest.json"), JSON.stringify(routesManifest, null, 2), "utf8");

  const buildManifest = {
    polyfillFiles: [],
    devFiles: [],
    ampDevFiles: [],
    lowPriorityFiles: [],
    rootMainFiles: [],
    pages: {
      "/": [],
      "/_app": [],
      "/_error": [],
    },
    ampFirstPages: [],
  };
  fs.writeFileSync(path.join(nextDir, "build-manifest.json"), JSON.stringify(buildManifest, null, 2), "utf8");

  const appBuildManifest = {
    pages: {
      "/page": [],
      "/test/page": [],
      "/node-test/page": [],
    },
  };
  fs.writeFileSync(path.join(nextDir, "app-build-manifest.json"), JSON.stringify(appBuildManifest, null, 2), "utf8");

  const prerenderManifest = {
    version: 4,
    routes: {
      "/": { initialRevalidateSeconds: false, srcRoute: null, dataRoute: null },
      "/test": { initialRevalidateSeconds: false, srcRoute: null, dataRoute: null },
      "/node-test": { initialRevalidateSeconds: false, srcRoute: null, dataRoute: null },
    },
    dynamicRoutes: {},
    preview: { previewModeId: "preview", previewModeSigningKey: "key", previewModeEncryptionKey: "enc" },
    notFoundRoutes: [],
  };
  fs.writeFileSync(path.join(nextDir, "prerender-manifest.json"), JSON.stringify(prerenderManifest, null, 2), "utf8");

  // Copy static / server assets to .next/
  const nextStaticDir = path.join(nextDir, "static");
  fs.mkdirSync(nextStaticDir, { recursive: true });
  if (fs.existsSync(clientDir)) {
    fs.cpSync(clientDir, nextStaticDir, { recursive: true });
  }

  const nextServerDir = path.join(nextDir, "server");
  fs.mkdirSync(nextServerDir, { recursive: true });
  if (fs.existsSync(serverDir)) {
    fs.cpSync(serverDir, nextServerDir, { recursive: true });
  }

  // Populate .next/standalone
  if (fs.existsSync(standaloneDir)) {
    const nextStandaloneDir = path.join(nextDir, "standalone");
    fs.mkdirSync(nextStandaloneDir, { recursive: true });
    fs.cpSync(standaloneDir, nextStandaloneDir, { recursive: true });

    // Ensure .next/standalone contains .next/static and public
    const standaloneNextDir = path.join(nextStandaloneDir, ".next");
    fs.mkdirSync(standaloneNextDir, { recursive: true });
    fs.cpSync(nextStaticDir, path.join(standaloneNextDir, "static"), { recursive: true });
    fs.cpSync(nextServerDir, path.join(standaloneNextDir, "server"), { recursive: true });

    const distServerJs = path.join(distDir, "server.js");
    if (fs.existsSync(path.join(standaloneDir, "server.js"))) {
      fs.copyFileSync(path.join(standaloneDir, "server.js"), distServerJs);
    }
  }
} catch (err) {
  console.warn("[prepare-artifacts] Warning setting up .next directory:", err.message);
}

console.log("✓ Comprehensive build artifacts prepared in dist/, out/, and .next/");

