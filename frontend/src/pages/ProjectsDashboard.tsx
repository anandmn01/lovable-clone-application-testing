import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  LogOut,
  Home,
  FolderOpen,
  Layout,
  History,
  Palette,
  Settings,
  Send,
  Paperclip,
  Sparkles,
  ChevronDown,
  ArrowRight,
  MoreHorizontal,
  Loader2,
  Trash,
  FileText,
  Globe,
  ShoppingCart,
  BookOpen,
  Zap,
  Command,
  User,
  Bot,
  Search,
  MoreVertical,
  Download,
  Edit,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, removeAuthToken, removeUserInfo, getUserInfo } from "@/lib/api";
import { ProjectSummaryResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ───────────────────────────────────────────────────────────────────
type View = "home" | "projects" | "templates" | "history" | "brandkit" | "settings";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// ─── Gemini direct API ────────────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

async function* streamGemini(history: ChatMsg[], newMessage: string): AsyncGenerator<string> {
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: newMessage }] },
  ];

  let lastError = "";

  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [
                {
                  text: "You are Project Companion, a premium AI web development assistant. Help users plan, design, and build software and web projects. Always format your responses beautifully using structured Markdown: use concise paragraphs, clear headers, bullet points for key concepts, bold terms, and properly highlighted code snippets.",
                },
              ],
            },
            generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        lastError = errText;
        console.warn(`Model ${model} returned ${res.status}:`, errText);
        continue;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let yieldedAny = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yieldedAny = true;
              yield text;
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (yieldedAny) return;
    } catch (err: any) {
      lastError = err.message || String(err);
      console.warn(`Model ${model} fetch failed:`, err);
    }
  }

  throw new Error(lastError || "All Gemini models failed. Please verify your API key and connection.");
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 transition-colors ${
          active ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <span>{label}</span>
    </button>
  );
}

// ─── Recent Chat Item ─────────────────────────────────────────────────────────
function RecentChatItem({ name, time, onClick }: { name: string; time: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5 transition-all group"
    >
      <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Globe className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 group-hover:text-white truncate">{name}</p>
        <p className="text-xs text-slate-600 mt-0.5">{time}</p>
      </div>
    </button>
  );
}

// ─── Quick Template Card ──────────────────────────────────────────────────────
function QuickTemplateCard({
  icon: Icon,
  iconBg,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 p-4 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15 transition-all group text-left"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-200 group-hover:text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex justify-end">
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
      </div>
    </button>
  );
}

// ─── Popular Template Row ─────────────────────────────────────────────────────
function PopularTemplateRow({
  title, badge, badgeColor, gradient,
}: { title: string; badge: string; badgeColor: string; gradient: string }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
      <div className={`w-12 h-9 rounded-lg flex-shrink-0 ${gradient}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 group-hover:text-white truncate">{title}</p>
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md mt-0.5 font-medium ${badgeColor}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}

// ─── Code Block ───────────────────────────────────────────────────────────────
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#09090e]">
      <div className="px-3.5 py-1.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto wc-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"} group`}>
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
          isUser
            ? "bg-violet-600 text-white shadow-violet-900/30"
            : "bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 text-violet-300"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-violet-400" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-violet-600 text-white px-4 py-3 shadow-lg shadow-violet-900/25"
            : "bg-white/[0.04] border border-white/10 px-5 py-4 text-slate-200 shadow-xl"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : (
          <div className="text-slate-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-white mt-4 mb-2 pb-1.5 border-b border-white/10 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-white mt-3.5 mb-2 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-violet-300 mt-3 mb-1.5 first:mt-0">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-sm font-semibold text-slate-200 mt-2.5 mb-1">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0 leading-relaxed text-slate-300 text-sm">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 space-y-1.5 my-3 text-slate-300 text-sm">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 space-y-1.5 my-3 text-slate-300 text-sm">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed pl-1">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-slate-200">{children}</em>
                ),
                hr: () => <hr className="my-4 border-white/10" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-violet-500 pl-3 py-1 my-3 bg-violet-500/5 rounded-r-lg text-slate-400 italic">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match && !String(children).includes("\n");
                  if (isInline) {
                    return (
                      <code
                        className="bg-white/10 border border-white/10 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <CodeBlock
                      language={match ? match[1] : ""}
                      code={String(children).replace(/\n$/, "")}
                    />
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-xl border border-white/10">
                    <table className="w-full text-xs text-left text-slate-300">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-white/5 text-slate-200 font-medium">{children}</thead>
                ),
                th: ({ children }) => <th className="px-3 py-2 border-b border-white/10">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border-b border-white/5">{children}</td>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>

            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-violet-400 animate-pulse rounded-sm align-middle" />
            )}

            {!msg.isStreaming && msg.content && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/8 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  Gemini AI
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all"
                  title="Copy response"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m} mins ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

function generateMiniGradient(name: string): React.CSSProperties {
  const colors: [string, string][] = [
    ["#7c3aed", "#3b82f6"], ["#059669", "#10b981"], ["#d97706", "#f59e0b"],
    ["#dc2626", "#f87171"], ["#2563eb", "#60a5fa"], ["#7c3aed", "#a78bfa"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  const [from, to] = colors[hash % colors.length];
  return { background: `linear-gradient(135deg, ${from}, ${to})` };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function ProjectsDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // View state
  const [activeNav, setActiveNav] = useState<View>("home");

  // Projects state
  const [projects, setProjects] = useState<ProjectSummaryResponse[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<ProjectSummaryResponse | null>(null);
  const [renameName, setRenameName] = useState("");

  // Chat state (Home view)
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userInfo = getUserInfo();
  const firstName = userInfo?.name?.split(" ")[0] || "there";

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const fetchProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  // ── Project actions ───────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const newProject = await api.createProject(newProjectName.trim());
      setProjects([newProject, ...projects]);
      setNewProjectName("");
      setIsDialogOpen(false);
      toast({ title: "Project created!", description: `"${newProject.name}" is ready.` });
      navigate(`/projects/${newProject.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await api.deleteProject(projectId.toString());
      setProjects(projects.filter((p) => p.id !== projectId));
      toast({ title: "Deleted", description: "Project removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  };

  const handleDownloadProject = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    try {
      const blob = await api.downloadProjectZip(projectId.toString());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `project-${projectId}.zip`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast({ title: "Download started" });
    } catch {
      toast({ title: "Error", description: "Failed to download", variant: "destructive" });
    }
  };

  const handleRenameSubmit = async () => {
    if (!projectToRename || !renameName.trim()) return;
    try {
      await api.updateProject(projectToRename.id.toString(), renameName);
      setProjects(projects.map((p) => p.id === projectToRename.id ? { ...p, name: renameName } : p));
      setIsRenameDialogOpen(false); setProjectToRename(null);
      toast({ title: "Renamed successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    removeAuthToken(); removeUserInfo(); navigate("/login");
  };

  // ── Gemini Chat ───────────────────────────────────────────────────────────
  const handleSendChat = async () => {
    const text = prompt.trim();
    if (!text || isSending) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const assistantMsg: ChatMsg = { role: "assistant", content: "", isStreaming: true };

    setChatHistory((prev) => [...prev, userMsg, assistantMsg]);
    setPrompt("");
    setIsSending(true);

    // reset textarea height
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    try {
      let accumulated = "";
      for await (const chunk of streamGemini(chatHistory, text)) {
        accumulated += chunk;
        setChatHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated, isStreaming: true };
          return updated;
        });
      }
      // Mark done
      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: accumulated, isStreaming: false };
        return updated;
      });
    } catch (err: any) {
      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, I encountered an error: ${err.message}. Please check your Gemini API key in .env (VITE_GEMINI_API_KEY).`,
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); }
  };

  const recentProjects = projects.slice(0, 5);
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickTemplates = [
    { icon: Layout, iconBg: "bg-violet-500/20 text-violet-400", title: "Portfolio Website", description: "Showcase your work and skills beautifully" },
    { icon: Zap, iconBg: "bg-blue-500/20 text-blue-400", title: "SaaS Landing Page", description: "Create a high-converting landing page" },
    { icon: ShoppingCart, iconBg: "bg-green-500/20 text-green-400", title: "E-commerce Store", description: "Build your online store and start selling" },
    { icon: BookOpen, iconBg: "bg-orange-500/20 text-orange-400", title: "Blog Website", description: "Share your stories with the world" },
  ];

  const popularTemplates = [
    { title: "SaaS Landing", badge: "Popular", badgeColor: "bg-violet-500/20 text-violet-400", gradient: "bg-gradient-to-br from-violet-500/40 to-blue-500/40" },
    { title: "Portfolio Minimal", badge: "Modern", badgeColor: "bg-slate-500/20 text-slate-400", gradient: "bg-gradient-to-br from-slate-600/40 to-slate-800/40" },
    { title: "E-commerce", badge: "Trending", badgeColor: "bg-green-500/20 text-green-400", gradient: "bg-gradient-to-br from-green-500/40 to-emerald-600/40" },
    { title: "Agency Website", badge: "Professional", badgeColor: "bg-blue-500/20 text-blue-400", gradient: "bg-gradient-to-br from-blue-500/40 to-cyan-500/40" },
  ];

  const tips = [
    "Be specific about your requirements",
    "Mention the type of website",
    "Include key sections you need",
    "Share your style preferences",
    "Add any reference websites",
  ];

  // ── Projects view ─────────────────────────────────────────────────────────
  const renderProjectsView = () => (
    <div className="flex-1 overflow-y-auto wc-scrollbar">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Projects</h1>
            <p className="text-slate-500 text-sm mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""} · stored in MinIO
            </p>
          </div>
          <button
            id="create-project-btn"
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-900/30"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-all"
          />
        </div>

        {/* Grid */}
        {loadingProjects ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-white/10 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/15 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-7 h-7 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              {searchQuery ? "No projects match your search" : "No projects yet"}
            </h3>
            <p className="text-slate-600 text-sm mb-6">
              {searchQuery ? "Try a different search term" : "Create your first project to get started"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsDialogOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
              >
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group rounded-2xl border border-white/8 bg-white/4 hover:bg-white/6 hover:border-white/15 transition-all cursor-pointer overflow-hidden"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {/* Thumbnail */}
                <div className="aspect-video relative overflow-hidden">
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full" style={generateMiniGradient(project.name)} />
                  )}
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white text-xs font-medium hover:bg-white/30 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                        {project.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        {formatRelativeTime(project.createdAt)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a1a2e] border-white/10 text-slate-300"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToRename(project);
                            setRenameName(project.name);
                            setIsRenameDialogOpen(true);
                          }}
                          className="hover:bg-white/5 cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDownloadProject(e, project.id)}
                          className="hover:bg-white/5 cursor-pointer"
                        >
                          <Download className="w-4 h-4 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          className="text-red-400 focus:text-red-400 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {project.role && (
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-2 border ${
                        project.role === "OWNER"
                          ? "bg-violet-500/15 text-violet-400 border-violet-500/20"
                          : project.role === "EDITOR"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                          : "bg-slate-700/50 text-slate-500 border-white/10"
                      }`}
                    >
                      {project.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Home Chat View ────────────────────────────────────────────────────────
  const renderHomeView = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto wc-scrollbar px-4 py-6">
        {chatHistory.length === 0 ? (
          /* Welcome / empty state */
          <div className="max-w-2xl mx-auto fade-up">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
                Hey {firstName}! <span className="wave-emoji">👋</span>
              </h1>
              <p className="text-lg text-slate-400 font-medium">Let's build something amazing today</p>
              <p className="text-sm text-slate-600 mt-1.5">
                Ask me anything or describe the website you want to build.
              </p>
            </div>

            {/* Quick Templates */}
            <p className="text-center text-xs text-slate-600 mb-6">Not sure where to start? Try one of these</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {quickTemplates.map((t, i) => (
                <QuickTemplateCard
                  key={i}
                  icon={t.icon}
                  iconBg={t.iconBg}
                  title={t.title}
                  description={t.description}
                  onClick={() => {
                    setPrompt(`Build me a ${t.title.toLowerCase()} with modern design`);
                    textareaRef.current?.focus();
                  }}
                />
              ))}
            </div>

            {/* File Drop Zone */}
            <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/3 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all p-8 text-center cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center mx-auto mb-3 group-hover:bg-violet-500/25">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-slate-400 mb-1">Import a brief, document or screenshot</p>
              <p className="text-xs text-slate-600">
                Drag and drop your file here, or{" "}
                <span className="text-violet-400 hover:text-violet-300">click to browse</span>
              </p>
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                {["PDF", "DOCX", "TXT", "Image"].map((fmt) => (
                  <div key={fmt} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8">
                    <FileText className="w-3 h-3 text-slate-500" />
                    <span className="text-[11px] text-slate-500 font-medium">{fmt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {chatHistory.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input bar — always visible at bottom */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2 border-t border-white/8 bg-[#0d0d12]">
        <div className="max-w-2xl mx-auto">
          <div
            className="relative rounded-2xl border border-white/12 bg-white/5 backdrop-blur-sm hover:border-white/20 focus-within:border-violet-500/40 transition-all shadow-xl"
          >
            <textarea
              ref={textareaRef}
              id="prompt-textarea"
              value={prompt}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                chatHistory.length === 0
                  ? "Describe the website you want to build..."
                  : "Ask a follow-up question..."
              }
              rows={2}
              className="w-full bg-transparent px-5 pt-4 pb-12 text-sm text-slate-200 placeholder-slate-600 resize-none outline-none leading-relaxed"
            />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button className="p-2 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-all">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300 transition-all">
                  <Plus className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-slate-400 text-xs border border-white/8 transition-all">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Smart suggestions
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <button
                id="send-btn"
                onClick={handleSendChat}
                disabled={isSending || !prompt.trim()}
                className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-violet-900/40"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {chatHistory.length === 0 && (
            <p className="text-center text-xs text-slate-700 mt-3">
              Powered by Gemini AI · Press Enter to send, Shift+Enter for new line
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .webcraft-root { font-family: 'Inter', sans-serif; }
        .wc-scrollbar::-webkit-scrollbar { width: 4px; }
        .wc-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .wc-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .wc-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        @keyframes waveHand {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-12deg); }
          75% { transform: rotate(12deg); }
        }
        .wave-emoji { display: inline-block; animation: waveHand 1.8s ease-in-out infinite; transform-origin: 70% 70%; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .border-white\/8  { border-color: rgba(255,255,255,0.08); }
        .border-white\/10 { border-color: rgba(255,255,255,0.10); }
        .border-white\/12 { border-color: rgba(255,255,255,0.12); }
        .border-white\/15 { border-color: rgba(255,255,255,0.15); }
        .bg-white\/3  { background: rgba(255,255,255,0.03); }
        .bg-white\/4  { background: rgba(255,255,255,0.04); }
        .bg-white\/5  { background: rgba(255,255,255,0.05); }
        .bg-white\/6  { background: rgba(255,255,255,0.06); }
        .bg-white\/8  { background: rgba(255,255,255,0.08); }
        .hover\\:bg-white\\/5:hover  { background: rgba(255,255,255,0.05); }
        .hover\\:bg-white\\/6:hover  { background: rgba(255,255,255,0.06); }
        .hover\\:bg-white\\/8:hover  { background: rgba(255,255,255,0.08); }
        .hover\\:bg-white\\/10:hover { background: rgba(255,255,255,0.10); }
        .hover\\:bg-white\\/15:hover { background: rgba(255,255,255,0.15); }
        .hover\\:border-white\\/15:hover { border-color: rgba(255,255,255,0.15); }
      `}</style>

      <div className="webcraft-root flex h-screen bg-[#0d0d12] text-white overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-[220px] flex-shrink-0 flex flex-col border-r border-white/8 bg-[#0f0f16]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Project Companion</span>
          </div>

          {/* New Chat */}
          <div className="px-3 mb-4">
            <button
              id="new-chat-btn"
              onClick={() => { setChatHistory([]); setPrompt(""); setActiveNav("home"); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-900/30"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
              <div className="ml-auto flex items-center gap-1 bg-white/15 rounded-md px-1.5 py-0.5">
                <Command className="w-3 h-3" />
                <span className="text-[10px]">K</span>
              </div>
            </button>
          </div>

          {/* Nav */}
          <nav className="px-3 flex flex-col gap-0.5">
            <NavItem icon={Home} label="Home" active={activeNav === "home"} onClick={() => setActiveNav("home")} />
            <NavItem icon={FolderOpen} label="Projects" active={activeNav === "projects"} onClick={() => setActiveNav("projects")} />
            <NavItem icon={Layout} label="Templates" active={activeNav === "templates"} onClick={() => setActiveNav("templates")} />
            <NavItem icon={History} label="History" active={activeNav === "history"} onClick={() => setActiveNav("history")} />
            <NavItem icon={Palette} label="Brand Kit" active={activeNav === "brandkit"} onClick={() => setActiveNav("brandkit")} />
            <NavItem icon={Settings} label="Settings" active={activeNav === "settings"} onClick={() => setActiveNav("settings")} />
          </nav>

          {/* Recent Chats */}
          {recentProjects.length > 0 && (
            <div className="mt-5 flex-1 overflow-hidden flex flex-col min-h-0">
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider px-4 mb-2">
                Recent Chats
              </p>
              <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-0.5 wc-scrollbar">
                {recentProjects.map((p) => (
                  <RecentChatItem
                    key={p.id}
                    name={p.name}
                    time={formatRelativeTime(p.createdAt)}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  />
                ))}
              </div>
              <div className="px-3 py-2">
                <button
                  onClick={() => setActiveNav("projects")}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  View all history <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Upgrade Banner */}
          <div className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-violet-900/40 to-blue-900/30 border border-violet-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-violet-300">Upgrade to Pro</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
              Unlock unlimited websites, custom domains, and more.
            </p>
            <button className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all">
              Upgrade Now ✦
            </button>
          </div>

          {/* User */}
          <div className="border-t border-white/8 p-3">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-violet-500/20 text-violet-400 text-sm font-semibold">
                  {userInfo?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{userInfo?.name || "User"}</p>
                <p className="text-[11px] text-slate-600 truncate">{userInfo?.username || ""}</p>
              </div>
              <button onClick={handleLogout} title="Sign out" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main + Right Panel ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/8 bg-[#0f0f16]/60 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">
                {activeNav === "home" ? "New Chat" : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-slate-300 text-sm transition-all border border-white/8">
                <Layout className="w-4 h-4" /> Templates
              </button>
              <button className="p-2 rounded-lg bg-white/6 hover:bg-white/10 text-slate-400 transition-all border border-white/8">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/6 border border-white/8">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-blue-400" />
                <span className="text-xs text-slate-300 font-medium">Credits</span>
                <span className="text-xs font-bold text-white">2,450</span>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeNav === "home" ? renderHomeView() : null}
              {activeNav === "projects" ? renderProjectsView() : null}
              {activeNav !== "home" && activeNav !== "projects" && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-violet-500/15 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-slate-400 font-medium capitalize">{activeNav}</p>
                    <p className="text-slate-600 text-sm mt-1">Coming soon</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel — only on Home */}
            {activeNav === "home" && (
              <aside className="w-[235px] flex-shrink-0 border-l border-white/8 bg-[#0f0f16] overflow-y-auto wc-scrollbar flex flex-col">
                {/* Tips */}
                <div className="p-4 border-b border-white/8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">Tips for better results</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full border border-white/15 flex-shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        </div>
                        <span className="text-[11px] text-slate-500 leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                  <button className="mt-4 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    Learn more tips <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Popular Templates */}
                <div className="p-4 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300">Popular Templates</span>
                    <button
                      onClick={() => setActiveNav("templates")}
                      className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      View all
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {popularTemplates.map((t, i) => (
                      <PopularTemplateRow key={i} {...t} />
                    ))}
                  </div>
                  <button className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/8 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-all">
                    Browse all templates <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Recent Projects mini */}
                {projects.length > 0 && (
                  <div className="p-4 border-t border-white/8">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-300">My Projects</span>
                      <button
                        onClick={() => setActiveNav("projects")}
                        className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        View all
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {projects.slice(0, 3).map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 cursor-pointer group transition-all"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={generateMiniGradient(project.name)} />
                          <p className="flex-1 text-xs text-slate-400 group-hover:text-white truncate transition-colors">
                            {project.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Project Dialog ────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Project</DialogTitle>
            <DialogDescription className="text-slate-500">
              Give your project a name. Files will be stored in MinIO.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="My Awesome Project"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              className="bg-white/5 border-white/10 text-slate-200 placeholder-slate-600 focus:border-violet-500/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5">
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={isCreating || !newProjectName.trim()}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Project Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Rename Project</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              className="bg-white/5 border-white/10 text-slate-200 focus:border-violet-500/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5">
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!renameName.trim() || renameName === projectToRename?.name}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
