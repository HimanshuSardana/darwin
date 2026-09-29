import { defineSandbox } from "eve/sandbox";
import { MicrosandboxSandbox } from "eve/sandbox/microsandbox";

// VM workspace: an isolated lightweight microVM rooted at /workspace.
// The built-in tools (bash, read_file, write_file, glob, grep) run here —
// nothing they do touches the host machine. Pinned explicitly (rather than
// auto-selected) so "Virtual machine" in the workspace picker always means
// this, including on hosts where auto-select might pick otherwise.
// prepare: microsandbox v0.5.5's embedded DNS forwarder (172.16.x gateway)
// answers nothing and its egress path breaks HTTP/2 TLS to some hosts, so
// every fresh VM would fail apt/curl without this. Public resolvers work
// (IP egress is fine). Baked into the prepared snapshot, so all
// subsequently opened VMs inherit it.
export const environment = MicrosandboxSandbox.environment({
  prepare: async (sandbox) => {
    const dns = await sandbox.run({
      command:
        'printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" | sudo tee /etc/resolv.conf >/dev/null && getent hosts github.com',
    });
    if (dns.exitCode !== 0) throw new Error(`DNS repair failed: ${dns.stderr}`);
  },
});

export default defineSandbox(() => environment.open());
