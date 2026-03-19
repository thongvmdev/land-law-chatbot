import { subDays, isToday, isYesterday, isWithinInterval } from "date-fns";

export interface ThreadItem {
  thread_id: string;
  title: string;
  created_at: string;
  values?: Record<string, any>;
}

export interface GroupedThreads {
  today: ThreadItem[];
  yesterday: ThreadItem[];
  lastSevenDays: ThreadItem[];
  older: ThreadItem[];
}

export function groupThreadsByDate(threads: ThreadItem[]): GroupedThreads {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const sevenDaysAgo = subDays(today, 7);

  return {
    today: threads
      .filter((thread) => isToday(new Date(thread.created_at)))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    yesterday: threads
      .filter((thread) => isYesterday(new Date(thread.created_at)))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    lastSevenDays: threads
      .filter((thread) =>
        isWithinInterval(new Date(thread.created_at), {
          start: sevenDaysAgo,
          end: yesterday,
        }),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    older: threads
      .filter((thread) => new Date(thread.created_at) < sevenDaysAgo)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
  };
}

export function prettifyDateLabel(group: string): string {
  switch (group) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "lastSevenDays":
      return "Last 7 days";
    case "older":
      return "Older";
    default:
      return group;
  }
}
