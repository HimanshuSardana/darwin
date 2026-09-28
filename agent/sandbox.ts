import { defineSandbox } from "eve/sandbox";
import { MicrosandboxSandbox } from "eve/sandbox/microsandbox";

// VM workspace: an isolated lightweight microVM rooted at /workspace.
// The built-in tools (bash, read_file, write_file, glob, grep) run here —
// nothing they do touches the host machine. Pinned explicitly (rather than
// auto-selected) so "Virtual machine" in the workspace picker always means
// this, including on hosts where auto-select might pick otherwise.
export const environment = MicrosandboxSandbox.environment();

export default defineSandbox(() => environment.open());
