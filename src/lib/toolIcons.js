import Terminal from "lucide-svelte/icons/terminal";
import FileText from "lucide-svelte/icons/file-text";
import FilePen from "lucide-svelte/icons/file-pen";
import Pencil from "lucide-svelte/icons/pencil";
import Search from "lucide-svelte/icons/search";
import FolderSearch from "lucide-svelte/icons/folder-search";
import Folder from "lucide-svelte/icons/folder";
import Globe from "lucide-svelte/icons/globe";
import Wrench from "lucide-svelte/icons/wrench";
import ListTree from "lucide-svelte/icons/list-tree";
import Sparkles from "lucide-svelte/icons/sparkles";

const MAP = {
  bash: Terminal,
  shell: Terminal,
  read: FileText,
  write: FilePen,
  edit: Pencil,
  multi_edit: Pencil,
  grep: Search,
  search: Search,
  find: FolderSearch,
  glob: FolderSearch,
  ls: Folder,
  list: Folder,
  web_search: Globe,
  web_fetch: Globe,
  fetch: Globe,
  todo_write: ListTree,
  todo_read: ListTree,
  task: Sparkles,
};

export function toolIcon(name) {
  const key = String(name ?? "").toLowerCase();
  return MAP[key] ?? Wrench;
}
