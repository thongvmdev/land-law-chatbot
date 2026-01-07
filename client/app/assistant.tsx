"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

import { createThread, getThreadState, sendMessage } from "@/lib/chatApi";
import { Thread } from "@/components/assistant-ui/thread";
import { ModelPicker } from "@/components/assistant-ui/model-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TooltipContentProps } from "@radix-ui/react-tooltip";
import {
  MenuIcon,
  PanelLeftIcon,
  ShareIcon,
  BookOpenIcon,
  FileTextIcon,
} from "lucide-react";
import { ComponentPropsWithRef, useState, type FC } from "react";
import { LawStructureModal } from "@/components/law-structure-modal";
import { PdfViewer } from "@/components/pdf-viewer";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThreadList } from "@/components/assistant-ui/thread-list";

type ButtonWithTooltipProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: TooltipContentProps["side"];
};

const ButtonWithTooltip: FC<ButtonWithTooltipProps> = ({
  children,
  tooltip,
  side = "top",
  ...rest
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...rest}>
          {children}
          <span className="sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

const Logo: FC = () => {
  return (
    <div className="flex items-center gap-2 px-2 text-sm font-medium">
      <div className="flex size-5 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
        L
      </div>
      <span className="text-foreground/90">Land Law Assistant</span>
    </div>
  );
};

const Sidebar: FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-muted/30 transition-all duration-200",
        collapsed ? "w-0 overflow-hidden opacity-0" : "w-[260px] opacity-100",
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ThreadList />
      </div>
    </aside>
  );
};

const MobileSidebar: FC = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 md:hidden"
        >
          <MenuIcon className="size-4" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>
        <div className="p-3">
          <ThreadList />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Header: FC<{
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenStructure: () => void;
  onOpenPdf: () => void;
}> = ({ sidebarCollapsed, onToggleSidebar, onOpenStructure, onOpenPdf }) => {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-4">
      <MobileSidebar />
      <ButtonWithTooltip
        variant="ghost"
        size="icon"
        tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        side="bottom"
        onClick={onToggleSidebar}
        className="hidden size-9 md:flex"
      >
        <PanelLeftIcon className="size-4" />
      </ButtonWithTooltip>
      {/* <ModelPicker /> */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenStructure}
        className="gap-2"
      >
        <BookOpenIcon className="size-4" />
        <span className="hidden sm:inline">Cấu trúc Luật</span>
      </Button>
      {/*  */}
      <ButtonWithTooltip
        variant="ghost"
        size="sm"
        onClick={onOpenPdf}
        tooltip="Xem văn bản PDF"
        side="bottom"
        className="gap-2"
      >
        <FileTextIcon className="size-4" />
        <span className="hidden sm:inline">Văn bản gốc</span>
      </ButtonWithTooltip>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <ButtonWithTooltip
          variant="ghost"
          size="icon"
          tooltip="Share"
          side="bottom"
          className="size-9"
        >
          <ShareIcon className="size-4" />
        </ButtonWithTooltip>
      </div>
    </header>
  );
};

export function Assistant() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const runtime = useLangGraphRuntime({
    stream: async function* (messages, { initialize, command }) {
      // Get or create thread
      let { externalId } = await initialize();
      let isNewThread = false;

      if (!externalId) {
        console.log(
          "🆕 No thread selected, creating new thread for first message...",
        );

        // Create thread without metadata - title will be extracted from first message later
        const { thread_id } = await createThread();
        externalId = thread_id;
        isNewThread = true;
        console.log("✅ Auto-created thread:", externalId);
      }

      console.log("💬 Sending message to thread:", externalId);

      const generator = await sendMessage({
        threadId: externalId,
        messages,
        command,
      });

      yield* generator;
    },
    create: async () => {
      const { thread_id } = await createThread();
      console.log("🎯 User manually created new thread:", thread_id);
      return { externalId: thread_id };
    },
    load: async (externalId) => {
      console.log("📂 Loading thread:", externalId);
      const state = await getThreadState(externalId);

      return {
        messages: state.values.messages,
      };
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full w-full bg-background [--primary-foreground:0_0%_98%] [--primary:0_0%_9%] dark:[--primary-foreground:0_0%_9%] dark:[--primary:0_0%_98%]">
        <div className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onOpenStructure={() => setStructureModalOpen(true)}
            onOpenPdf={() => setPdfViewerOpen(true)}
          />
          <main className="flex-1 overflow-hidden">
            <Thread />
          </main>
        </div>
      </div>
      <LawStructureModal
        open={structureModalOpen}
        onOpenChange={setStructureModalOpen}
      />
      <PdfViewer open={pdfViewerOpen} onOpenChange={setPdfViewerOpen} />
    </AssistantRuntimeProvider>
  );
}
