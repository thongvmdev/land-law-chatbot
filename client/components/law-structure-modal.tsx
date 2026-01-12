"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  FileTextIcon,
  FolderIcon,
} from "lucide-react";
import {
  lawStructure,
  searchStructure,
  countArticles,
  type LawNode,
  type LawChapter,
  type LawSection,
  type LawArticle,
} from "@/utils/lawStructure";
import { cn } from "@/utils";

type LawStructureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LawStructureModal({
  open,
  onOpenChange,
}: LawStructureModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredStructure = searchStructure(lawStructure, searchQuery);
  const totalArticles = countArticles(lawStructure);
  const filteredArticles = countArticles(filteredStructure);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpenIcon className="size-6" />
            Cấu trúc Luật Đất đai 2024
          </DialogTitle>
          <DialogDescription>
            Tra cứu các chương, mục và điều trong Luật Đất đai Việt Nam 2024
          </DialogDescription>
        </DialogHeader>

        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm kiếm điều, chương, mục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tìm thấy {filteredArticles} / {totalArticles} điều luật
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredStructure.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <SearchIcon className="mb-4 size-12 text-muted-foreground/50" />
              <p className="text-lg font-medium text-muted-foreground">
                Không tìm thấy kết quả
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Thử tìm kiếm với từ khóa khác
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStructure.map((chapter, index) => (
                <ChapterNode
                  key={`chapter-${index}`}
                  node={chapter as LawChapter}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChapterNode({ node }: { node: LawChapter }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-3 py-3 hover:bg-muted"
        >
          {isOpen ? (
            <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
          )}
          <BookOpenIcon className="size-5 shrink-0 text-primary" />
          <span className="text-left text-base font-semibold">
            {node.title}
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-4">
        <div className="space-y-1 border-l-2 border-muted pl-2">
          {node.children.map((child, index) => (
            <ChildNode
              key={`${node.title}-child-${index}`}
              node={child}
              depth={1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChildNode({ node, depth }: { node: LawNode; depth: number }) {
  if (node.type === "article") {
    return <ArticleNode node={node} depth={depth} />;
  }

  if (node.type === "section") {
    return <SectionNode node={node} depth={depth} />;
  }

  return null;
}

function SectionNode({ node, depth }: { node: LawSection; depth: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 hover:bg-muted/50",
            depth > 1 && "pl-4",
          )}
        >
          {isOpen ? (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <FolderIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span className="text-left text-sm font-medium">{node.title}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-4">
        <div className="space-y-1">
          {node.children.map((child, index) => (
            <ChildNode
              key={`${node.title}-child-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ArticleNode({ node, depth }: { node: LawArticle; depth: number }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-muted/30",
        depth > 1 && "pl-4",
      )}
    >
      <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-sm text-foreground/90">{node.title}</span>
    </div>
  );
}
