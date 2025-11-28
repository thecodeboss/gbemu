import { useEffect, useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@/components/ui/table";
import {
  RecentRomRecord,
  RecentRomSummary,
  listRecentRoms,
  loadRecentRom,
} from "@/lib/recently-played";
import { cn } from "@/lib/utils";

interface RecentlyPlayedTableProps {
  onSelectRom: (rom: RecentRomRecord) => Promise<void> | void;
  refreshToken?: number;
  pageSize?: number;
  active?: boolean;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 5;

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 45) return "A few seconds ago";
  if (diffSeconds < 90) return "A minute ago";
  if (diffMinutes < 45) return "A few minutes ago";
  if (diffMinutes < 90) return "An hour ago";
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "Last week";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "Last month";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return "Last year";
  return `${diffYears} years ago`;
};

export function RecentlyPlayedTable({
  onSelectRom,
  refreshToken = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  active = true,
  className,
}: RecentlyPlayedTableProps) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RecentRomSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const hasPagination = useMemo(
    () => Math.ceil(total / pageSize) > 1,
    [pageSize, total],
  );

  useEffect(() => {
    setPage(1);
  }, [refreshToken]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void listRecentRoms(page, pageSize)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setTotal(result.total);
        const nextTotalPages = Math.max(1, Math.ceil(result.total / pageSize));
        if (page > nextTotalPages) {
          setPage(nextTotalPages);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load recently played ROMs.",
        );
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, page, pageSize, refreshToken]);

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    setError(null);
    try {
      const rom = await loadRecentRom(id);
      if (!rom) {
        setError("This ROM is no longer available.");
        return;
      }
      await onSelectRom(rom);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to open the selected ROM.",
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Recently Played
        </div>
      </div>

      {error ? (
        <div className="rounded-sm border-[3px] border-destructive bg-destructive/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-destructive">
          {error}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/30">
            <TableHead>Filename</TableHead>
            <TableHead className="w-36 text-right">Last Played</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="text-center text-muted-foreground"
              >
                {isLoading ? "Loading..." : "No recent ROMs stored yet."}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer border-b border-border/60 hover:bg-accent/30"
                onClick={() => handleSelect(item.id)}
                aria-busy={loadingId === item.id}
              >
                <TableCell className="truncate">{item.name}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatRelativeTime(item.lastPlayed)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasPagination ? (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
