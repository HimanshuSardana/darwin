/** Curated package catalog for microVM workspaces.
 *  Dependency-free: imported by both client components and API routes.
 *  Install commands target the default Debian-based VM image and must be
 *  non-interactive and idempotent (safe to re-run when already installed).
 */
export interface CatalogPackage {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Binary probed with `command -v` to decide whether install is needed. */
  readonly check: string;
  /** Full shell command that installs the package inside the VM. */
  readonly install: string;
}

export const PACKAGE_CATALOG: readonly CatalogPackage[] = [
  {
    id: "typst",
    label: "Typst",
    description: "Modern typesetting for PDFs and documents",
    check: "typst",
    install:
      "sudo apt-get update -qq && sudo apt-get install -y -qq xz-utils curl ca-certificates && mkdir -p ~/.local/bin && curl --http1.1 -LsSf https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz | tar -xJ -C ~/.local/bin --strip-components=1 && export PATH=\"$HOME/.local/bin:$PATH\"",
  },
  {
    id: "pandoc",
    label: "Pandoc",
    description: "Universal document converter",
    check: "pandoc",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq pandoc",
  },
  {
    id: "ffmpeg",
    label: "FFmpeg",
    description: "Audio/video transcoding and inspection",
    check: "ffmpeg",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg",
  },
  {
    id: "imagemagick",
    label: "ImageMagick",
    description: "Image conversion and manipulation",
    check: "convert",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq imagemagick",
  },
  {
    id: "jq",
    label: "jq",
    description: "JSON processor for the shell",
    check: "jq",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq jq",
  },
  {
    id: "yq",
    label: "yq",
    description: "YAML/TOML processor (mikefarah build)",
    check: "yq",
    install:
      "sudo curl --http1.1 -LsSf https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/local/bin/yq && sudo chmod +x /usr/local/bin/yq",
  },
  {
    id: "gh",
    label: "GitHub CLI",
    description: "gh for repos, PRs, and releases",
    check: "gh",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq gh",
  },
  {
    id: "poppler",
    label: "Poppler",
    description: "pdftotext/pdftoppm PDF extraction tools",
    check: "pdftotext",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq poppler-utils",
  },
  {
    id: "sqlite",
    label: "SQLite",
    description: "sqlite3 shell for local databases",
    check: "sqlite3",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq sqlite3",
  },
  {
    id: "ripgrep",
    label: "ripgrep",
    description: "Fast recursive code search (rg)",
    check: "rg",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq ripgrep",
  },
  {
    id: "uv",
    label: "uv",
    description: "Fast Python package and project manager",
    check: "uv",
    install: "curl -LsSf https://astral.sh/uv/install.sh | sh",
  },
  {
    id: "node",
    label: "Node.js",
    description: "Node runtime plus npm",
    check: "node",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq nodejs npm",
  },
  {
    id: "go",
    label: "Go",
    description: "Go toolchain",
    check: "go",
    install: "sudo apt-get update -qq && sudo apt-get install -y -qq golang-go",
  },
];

const BY_ID = new Map(PACKAGE_CATALOG.map((entry) => [entry.id, entry]));

export function catalogPackage(id: string): CatalogPackage | undefined {
  return BY_ID.get(id);
}

/** Keep only known ids, deduplicated, catalog order preserved. */
export function sanitizePackageIds(ids: readonly unknown[]): string[] {
  const wanted = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && BY_ID.has(id)) wanted.add(id);
  }
  return PACKAGE_CATALOG.filter((entry) => wanted.has(entry.id)).map(
    (entry) => entry.id,
  );
}
