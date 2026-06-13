"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent,
} from "react";
import {onAuthStateChanged, type User} from "firebase/auth";
import {doc, getDoc, onSnapshot, serverTimestamp, setDoc} from "firebase/firestore";
import {Edit3, Loader2, Plus, Send, Trash2, Volume2, X} from "lucide-react";

import {auth, db} from "@/lib/firebase";

type NotebookTab = {
  id: string;
  name: string;
  contentHtml: string;
  contentText: string;
  updatedAt: string;
};

type NotebookDraft = {
  tabs: NotebookTab[];
  activeTabId: string | null;
  status?: "draft" | "submitted";
  submittedAt?: string;
};

type HighlightDraft = {
  x: number;
  y: number;
  word: string;
  note: string;
  range: Range;
};

type HighlightHover = {
  x: number;
  y: number;
  word: string;
  note: string;
  element: HTMLElement;
  phonetics?: string;
};

const localPrefix = "streamline-notebook";

function createTab(name = "New tab"): NotebookTab {
  const now = new Date().toISOString();

  return {
    id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    contentHtml: "",
    contentText: "",
    updatedAt: now,
  };
}

function loadLocalNotebook(lessonId: string): NotebookDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${localPrefix}:${lessonId}`);
    return raw ? (JSON.parse(raw) as NotebookDraft) : null;
  } catch {
    return null;
  }
}

function saveLocalNotebook(lessonId: string, data: NotebookDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${localPrefix}:${lessonId}`, JSON.stringify(data));
}

function normalizeNotebook(data: Partial<NotebookDraft> | null): NotebookDraft {
  const tabs = Array.isArray(data?.tabs) ? data.tabs : [];
  const firstTabId = tabs[0]?.id ?? null;
  const activeTabId =
    data?.activeTabId && tabs.some((tab) => tab.id === data.activeTabId)
      ? data.activeTabId
      : firstTabId;

  return {
    tabs,
    activeTabId,
    status: data?.status ?? "draft",
    submittedAt: data?.submittedAt,
  };
}

function submissionDocId(lessonId: string, uid: string) {
  return `${uid}_${lessonId}`;
}

export function LessonNotebook({
  lessonId,
  lessonTitle,
}: {
  lessonId: string;
  lessonTitle: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUserRef = useRef<User | null>(null);

  const tabsRef = useRef<NotebookTab[]>([]);
  const activeTabIdRef = useRef<string | null>(null);

  // Seed dong bo tabs + activeTabId
  const notebookSeed = useMemo(() => {
    const local = loadLocalNotebook(lessonId);
    if (local && local.tabs.length > 0) {
      return {tabs: local.tabs, activeTabId: local.activeTabId};
    }
    const firstTab = createTab("Notebook 1");
    return {tabs: [firstTab], activeTabId: firstTab.id};
  }, [lessonId]);

  const [tabs, setTabs] = useState<NotebookTab[]>(notebookSeed.tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(notebookSeed.activeTabId);

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [highlightDraft, setHighlightDraft] = useState<HighlightDraft | null>(null);
  const [highlightHover, setHighlightHover] = useState<HighlightHover | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );

  // Seed localStorage neu chua co
  useEffect(() => {
    const local = loadLocalNotebook(lessonId);
    if (!local || local.tabs.length === 0) {
      saveLocalNotebook(lessonId, {
        tabs: notebookSeed.tabs,
        activeTabId: notebookSeed.activeTabId,
        status: "draft",
      });
    }
  }, [lessonId, notebookSeed]);

  const persistDraft = useCallback(
    async (nextTabs: NotebookTab[], nextActiveTabId: string | null) => {
      const draft: NotebookDraft = {tabs: nextTabs, activeTabId: nextActiveTabId, status: "draft"};
      saveLocalNotebook(lessonId, draft);

      const user = currentUserRef.current ?? auth.currentUser;
      if (!user) {
        setStatus("saved");
        setMessage("Saved on this device.");
        return;
      }

      setStatus("saving");
      try {
        await setDoc(
          doc(db, "submissions", submissionDocId(lessonId, user.uid)),
          {
            userId: user.uid,
            userEmail: user.email,
            lessonId,
            lessonTitle,
            notes: nextTabs,
            activeTabId: nextActiveTabId,
            status: "draft",
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
        setStatus("saved");
        setMessage("Saved.");
      } catch {
        setStatus("saved");
        setMessage("Saved on this device.");
      }
    },
    [lessonId, lessonTitle],
  );

  const scheduleSave = useCallback(
    (nextTabs: NotebookTab[], nextActiveTabId: string | null) => {
      saveLocalNotebook(lessonId, {tabs: nextTabs, activeTabId: nextActiveTabId, status: "draft"});
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistDraft(nextTabs, nextActiveTabId), 500);
    },
    [lessonId, persistDraft],
  );

  function getLatestTabsFromEditor(): NotebookTab[] {
    const editor = editorRef.current;
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    if (!editor || !currentActiveId) return currentTabs;
    return currentTabs.map((tab) =>
      tab.id === currentActiveId
        ? {...tab, contentHtml: editor.innerHTML, contentText: editor.innerText, updatedAt: new Date().toISOString()}
        : tab,
    );
  }

  useEffect(() => {
    function handleBeforeUnload() {
      const editor = editorRef.current;
      const currentTabs = tabsRef.current;
      const currentActiveId = activeTabIdRef.current;
      if (!editor || !currentActiveId) return;
      const nextTabs = currentTabs.map((tab) =>
        tab.id === currentActiveId
          ? {...tab, contentHtml: editor.innerHTML, contentText: editor.innerText, updatedAt: new Date().toISOString()}
          : tab,
      );
      saveLocalNotebook(lessonId, {tabs: nextTabs, activeTabId: currentActiveId, status: "draft"});
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lessonId]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeRemote: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      currentUserRef.current = user;
      unsubscribeRemote?.();
      unsubscribeRemote = null;

      if (!user) {
        setMessage("Saved on this device.");
        return;
      }

      const notebookRef = doc(db, "submissions", submissionDocId(lessonId, user.uid));

      unsubscribeRemote = onSnapshot(
        notebookRef,
        (snapshot) => {
          if (!isMounted) return;

          if (!snapshot.exists()) {
            const localData = loadLocalNotebook(lessonId);
            if (localData && localData.tabs.length > 0) {
              void persistDraft(localData.tabs, localData.activeTabId);
            }
            return;
          }

          const data = snapshot.data();
          const remote = normalizeNotebook({
            tabs: Array.isArray(data.notes) ? data.notes : [],
            activeTabId: typeof data.activeTabId === "string" ? data.activeTabId : null,
            status: data.status === "submitted" ? "submitted" : "draft",
          });

          if (remote.tabs.length === 0) return;

          const localData = loadLocalNotebook(lessonId);
          const localTabs = localData?.tabs ?? tabsRef.current;
          const localMaxTime = localTabs.length ? Math.max(...localTabs.map((t) => new Date(t.updatedAt).getTime())) : 0;
          const remoteMaxTime = Math.max(...remote.tabs.map((t) => new Date(t.updatedAt).getTime()));

          if (remoteMaxTime <= localMaxTime) return;

          setTabs(remote.tabs);
          setActiveTabId(remote.activeTabId);
          saveLocalNotebook(lessonId, remote);
          setStatus("saved");
          setMessage("Synced.");
        },
        () => {
          if (isMounted) {
            setStatus("saved");
            setMessage("Synced.");
          }
        },
      );
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeRemote?.();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (hideHoverTimerRef.current) clearTimeout(hideHoverTimerRef.current);
      pronunciationAudioRef.current?.pause();
    };
  }, [lessonId, persistDraft]);

  useEffect(() => {
    if (editorRef.current && activeTab) {
      editorRef.current.innerHTML = activeTab.contentHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  function updateActiveTabFromEditor() {
    const editor = editorRef.current;
    const currentActiveId = activeTabIdRef.current;
    if (!editor || !currentActiveId) return;
    const nextTabs = tabsRef.current.map((tab) =>
      tab.id === currentActiveId
        ? {...tab, contentHtml: editor.innerHTML, contentText: editor.innerText, updatedAt: new Date().toISOString()}
        : tab,
    );
    setTabs(nextTabs);
    scheduleSave(nextTabs, currentActiveId);
  }

  function addTab() {
    const tabName = window.prompt("Enter tab name:", `Notebook ${tabsRef.current.length + 1}`);
    if (!tabName?.trim()) return;
    const nextTab = createTab(tabName.trim());
    const nextTabs = [...tabsRef.current, nextTab];
    setTabs(nextTabs);
    setActiveTabId(nextTab.id);
    scheduleSave(nextTabs, nextTab.id);
  }

  function renameTab(tabId: string) {
    const tab = tabsRef.current.find((item) => item.id === tabId);
    const nextName = window.prompt("Rename tab:", tab?.name ?? "");
    if (!nextName?.trim()) return;
    const nextTabs = tabsRef.current.map((item) =>
      item.id === tabId ? {...item, name: nextName.trim()} : item,
    );
    setTabs(nextTabs);
    scheduleSave(nextTabs, activeTabIdRef.current);
  }

  function deleteTab(tabId: string) {
    // Capture editor content truoc khi xoa
    const currentTabs = getLatestTabsFromEditor();
    const tab = currentTabs.find((item) => item.id === tabId);
    if (!window.confirm(`Delete "${tab?.name ?? "this tab"}"?`)) return;
    const nextTabs = currentTabs.filter((item) => item.id !== tabId);
    const nextActiveId = activeTabIdRef.current === tabId ? nextTabs[0]?.id ?? null : activeTabIdRef.current;
    setTabs(nextTabs);
    setActiveTabId(nextActiveId);
    scheduleSave(nextTabs, nextActiveId);
  }

  async function submitNotebook() {
    const user = currentUserRef.current ?? auth.currentUser;
    const currentTabs = getLatestTabsFromEditor();
    if (!user) {
      setStatus("error");
      setMessage("Please log in before sending notebook.");
      return;
    }
    if (currentTabs.length === 0 || !window.confirm("Send this notebook to teacher?")) return;

    setTabs(currentTabs);
    setStatus("saving");

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userName = typeof userDoc.data()?.fullname === "string" ? userDoc.data()?.fullname : "Unknown";

      await setDoc(
        doc(db, "submissions", submissionDocId(lessonId, user.uid)),
        {
          userId: user.uid,
          userEmail: user.email,
          userName,
          lessonId,
          lessonTitle,
          notes: currentTabs,
          activeTabId,
          status: "submitted",
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {merge: true},
      );

      saveLocalNotebook(lessonId, {tabs: currentTabs, activeTabId, status: "submitted", submittedAt: new Date().toISOString()});
      setStatus("sent");
      setMessage("Sent to teacher.");
    } catch {
      setStatus("error");
      setMessage("Could not send notebook.");
    }
  }

  function handleEditorMouseUp(event: MouseEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0 || !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    const word = selection.toString().trim();
    if (!word) return;
    setHighlightDraft({
      x: Math.min(event.clientX + 12, window.innerWidth - 300),
      y: Math.min(event.clientY + 12, window.innerHeight - 220),
      word,
      note: "",
      range: selection.getRangeAt(0).cloneRange(),
    });
  }

  function saveHighlight() {
    if (!highlightDraft) return;
    const span = document.createElement("span");
    span.className = "cursor-help rounded-sm bg-amber-200/90 px-0.5 underline decoration-amber-500/70 decoration-2 underline-offset-2";
    span.dataset.notebookHighlight = "true";
    span.dataset.word = highlightDraft.word;
    span.dataset.note = highlightDraft.note;
    span.title = highlightDraft.note || highlightDraft.word;
    try {
      highlightDraft.range.surroundContents(span);
    } catch {
      const content = highlightDraft.range.extractContents();
      span.appendChild(content);
      highlightDraft.range.insertNode(span);
    }
    window.getSelection()?.removeAllRanges();
    setHighlightDraft(null);
    updateActiveTabFromEditor();
  }

  function clearHideHoverTimer() {
    if (hideHoverTimerRef.current) {
      clearTimeout(hideHoverTimerRef.current);
      hideHoverTimerRef.current = null;
    }
  }

  async function handleHighlightEnter(element: HTMLElement) {
    clearHideHoverTimer();
    setAudioError("");
    const rect = element.getBoundingClientRect();
    const word = element.dataset.word || element.textContent?.trim() || "";
    const note = element.dataset.note || element.title || "";
    if (!word) return;
    setHighlightHover({
      x: Math.min(rect.right + 12, window.innerWidth - 300),
      y: Math.min(rect.top, window.innerHeight - 192),
      word,
      note,
      element,
    });
    try {
      const response = await fetch(`/api/oxford-pronunciation?word=${encodeURIComponent(word)}&lang=uk`);
      const data = (await response.json()) as {phonetics?: string};
      if (data.phonetics) {
        setHighlightHover((current) => (current?.word === word ? {...current, phonetics: data.phonetics} : current));
      }
    } catch {
      // Phonetics is optional
    }
  }

  function handleEditorMouseOver(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const highlight = target.closest<HTMLElement>("[data-notebook-highlight='true']");
    if (highlight && editorRef.current?.contains(highlight)) {
      void handleHighlightEnter(highlight);
    }
  }

  function handleEditorMouseOut(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const highlight = target.closest("[data-notebook-highlight='true']");
    if (!highlight) return;
    clearHideHoverTimer();
    hideHoverTimerRef.current = setTimeout(() => setHighlightHover(null), 180);
  }

  async function playPronunciation(word: string) {
    setAudioError("");
    setIsAudioLoading(true);
    try {
      const response = await fetch(`/api/oxford-pronunciation?word=${encodeURIComponent(word)}&lang=uk`);
      const data = (await response.json()) as {audioUrl?: string; error?: string};
      if (!response.ok || !data.audioUrl) {
        setAudioError(data.error ?? "Khong tim thay phat am.");
        return;
      }
      pronunciationAudioRef.current?.pause();
      const audio = new Audio(data.audioUrl);
      pronunciationAudioRef.current = audio;
      await audio.play();
    } catch {
      setAudioError("Khong the phat am. Thu lai sau.");
    } finally {
      setIsAudioLoading(false);
    }
  }

  function deleteHoveredHighlight() {
    if (!highlightHover) return;
    const {element} = highlightHover;
    const parent = element.parentNode;
    if (!parent) {
      setHighlightHover(null);
      return;
    }
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
    setHighlightHover(null);
    updateActiveTabFromEditor();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[520px] flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addTab}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={15} />
            Tab
          </button>
          <button
            type="button"
            onClick={submitNotebook}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Send size={15} />
            Send
          </button>
        </div>
        <p className={`text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`}>
          {message || "Auto-save is on."}
        </p>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm ${
              tab.id === activeTabId
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <button type="button" onClick={() => setActiveTabId(tab.id)} className="max-w-40 truncate px-1 py-1 font-semibold" title={tab.name}>
              {tab.name}
            </button>
            <button type="button" onClick={() => renameTab(tab.id)} className="rounded p-1 hover:bg-white" title="Rename">
              <Edit3 size={13} />
            </button>
            <button type="button" onClick={() => deleteTab(tab.id)} className="rounded p-1 text-red-600 hover:bg-white" title="Delete">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable={Boolean(activeTab)}
        suppressContentEditableWarning
        onInput={updateActiveTabFromEditor}
        onMouseUp={handleEditorMouseUp}
        onMouseOver={handleEditorMouseOver}
        onMouseOut={handleEditorMouseOut}
        onPaste={handlePaste}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 text-base leading-7 text-slate-900 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] focus:border-emerald-500"
        data-placeholder="Write your notes here..."
      />

      {highlightDraft ? (
        <div className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl" style={{left: highlightDraft.x, top: highlightDraft.y}}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-amber-800">{highlightDraft.word}</p>
            <button type="button" onClick={() => setHighlightDraft(null)} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={highlightDraft.note}
            onChange={(event) => setHighlightDraft((value) => (value ? {...value, note: event.target.value} : value))}
            className="min-h-20 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Ghi nghia, ghi chu..."
            autoFocus
          />
          <button type="button" onClick={saveHighlight} className="mt-2 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Save highlight
          </button>
        </div>
      ) : null}

      {highlightHover && !highlightDraft ? (
        <div
          className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{left: highlightHover.x, top: highlightHover.y}}
          onMouseEnter={clearHideHoverTimer}
          onMouseLeave={() => setHighlightHover(null)}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <span className="truncate text-sm font-semibold text-amber-800">{highlightHover.word}</span>
            <button type="button" onClick={() => setHighlightHover(null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" title="Dong">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2 p-3">
            {highlightHover.phonetics ? <p className="text-sm font-semibold text-slate-600">{`/${highlightHover.phonetics.replace(/^\/+|\/+$/g, "")}/`}</p> : null}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{highlightHover.note || "(Chua co ghi chu)"}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => playPronunciation(highlightHover.word)}
                disabled={isAudioLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                title="Nghe phat am (Oxford)"
              >
                {isAudioLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                Nghe
              </button>
              <button
                type="button"
                onClick={deleteHoveredHighlight}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                title="Xoa highlight"
              >
                <Trash2 size={14} />
                Xoa
              </button>
            </div>
            {audioError ? <p className="text-xs text-red-600">{audioError}</p> : null}
            <a
              href={`https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(highlightHover.word.toLowerCase())}`}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-slate-500 underline-offset-2 hover:text-emerald-700 hover:underline"
            >
              Mo tren Oxford Learner{"'"}s Dictionaries
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}