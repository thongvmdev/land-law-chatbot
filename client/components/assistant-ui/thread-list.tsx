import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantIf, useAssistantApi } from "@assistant-ui/react";
import { ArchiveIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type FC, useState, useEffect } from "react";
import {
  groupThreadsByDate,
  prettifyDateLabel,
  type ThreadItem,
} from "./thread-list-utils";
import { listThreads, deleteThread } from "@/lib/chatApi";

export const ThreadList: FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [newThreadId, setNewThreadId] = useState<string | null>(null);

  const handleNewThread = (threadId?: string) => {
    // Set the new thread ID to highlight it
    if (threadId) {
      setNewThreadId(threadId);
    }
    // Trigger a refresh of the thread list
    setRefreshKey((prev) => prev + 1);
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="aui-root aui-thread-list-root flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <ThreadListNew onNewThread={handleNewThread} />
        <DeleteAllThreads onDeleted={handleRefresh} />
      </div>
      <AssistantIf condition={({ threads }) => threads.isLoading}>
        <ThreadListSkeleton />
      </AssistantIf>
      <AssistantIf condition={({ threads }) => !threads.isLoading}>
        <GroupedThreadListItems
          key={refreshKey}
          initialSelectedId={newThreadId}
        />
      </AssistantIf>
    </div>
  );
};

const GroupedThreadListItems: FC<{ initialSelectedId?: string | null }> = ({
  initialSelectedId,
}) => {
  const api = useAssistantApi();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialSelectedId || null,
  );

  // Update selected thread when initialSelectedId changes
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedThreadId(initialSelectedId);
    }
  }, [initialSelectedId]);

  const fetchThreadsData = async () => {
    try {
      setIsLoading(true);
      const fetchedThreads = await listThreads();
      setThreads(fetchedThreads);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThreadsData();
  }, []);

  const handleThreadClick = async (threadId: string) => {
    try {
      setSelectedThreadId(threadId);
      // Switch to the selected thread using api
      api.threads().switchToThread(threadId);
    } catch (error) {
      console.error("Failed to switch thread:", error);
    }
  };

  const handleArchiveThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation(); // Prevent triggering thread click
    try {
      await deleteThread(threadId);
      // Refresh thread list after deletion
      await fetchThreadsData();
      // If the deleted thread was selected, clear selection
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  if (isLoading) {
    return <ThreadListSkeleton />;
  }

  const groupedThreads = groupThreadsByDate(threads);

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groupedThreads).map(([group, groupThreads]) =>
        groupThreads.length > 0 ? (
          <div key={group}>
            <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">
              {prettifyDateLabel(group)}
            </h3>
            <div className="flex flex-col gap-1">
              {groupThreads.map((thread: ThreadItem) => (
                <div
                  key={thread.thread_id}
                  onClick={() => handleThreadClick(thread.thread_id)}
                  className={`aui-thread-list-item group flex h-9 cursor-pointer items-center rounded-lg transition-colors focus-visible:outline-none ${
                    selectedThreadId === thread.thread_id ? "bg-muted" : ""
                  }`}
                >
                  <div className="aui-thread-list-item-trigger flex h-full flex-1 items-center truncate px-3 text-start text-sm">
                    <span className="truncate">{thread.title}</span>
                  </div>
                  <TooltipIconButton
                    variant="ghost"
                    tooltip="Archive thread"
                    onClick={(e) => handleArchiveThread(e, thread.thread_id)}
                    className="aui-thread-list-item-archive mr-2 size-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ArchiveIcon className="size-4" />
                  </TooltipIconButton>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
};

const ThreadListNew: FC<{ onNewThread: (threadId?: string) => void }> = ({
  onNewThread,
}) => {
  const api = useAssistantApi();

  const handleNewThreadClick = async () => {
    try {
      // Create a new thread using api
      api.threads().switchToNewThread();

      // Get the new thread ID and pass it back
      // Trigger refresh of thread list after a short delay to allow backend to process
      setTimeout(() => {
        onNewThread();
      }, 500);
    } catch (error) {
      console.error("Failed to create new thread:", error);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleNewThreadClick}
      className="aui-thread-list-new h-9 justify-start gap-2 rounded-lg px-3 text-sm hover:bg-muted data-active:bg-muted"
    >
      <PlusIcon className="size-4" />
      New Thread
    </Button>
  );
};

const DeleteAllThreads: FC<{ onDeleted: () => void }> = ({ onDeleted }) => {
  const api = useAssistantApi();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete all threads? This action cannot be undone.",
    );

    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      // Fetch all threads
      const threads = await listThreads();

      // Delete each thread
      await Promise.all(
        threads.map((thread) => deleteThread(thread.thread_id)),
      );

      // Create a new thread after deleting all
      api.threads().switchToNewThread();

      // Refresh the thread list
      setTimeout(() => {
        onDeleted();
      }, 500);
    } catch (error) {
      console.error("Failed to delete all threads:", error);
      alert("Failed to delete all threads. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDeleteAll}
      disabled={isDeleting}
      className="h-9 justify-start gap-2 rounded-lg border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2Icon className="size-4" />
      {isDeleting ? "Deleting..." : "Delete All Threads"}
    </Button>
  );
};

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading threads"
          className="aui-thread-list-skeleton-wrapper flex h-9 items-center px-3"
        >
          <Skeleton className="aui-thread-list-skeleton h-4 w-full" />
        </div>
      ))}
    </div>
  );
};
