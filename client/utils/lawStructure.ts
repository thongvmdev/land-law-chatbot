import structureData from "@/data/structure_.json";

/**
 * Law structure types
 */
export type LawArticle = {
  type: "article";
  title: string;
};

export type LawSection = {
  type: "section";
  title: string;
  children: LawNode[];
};

export type LawChapter = {
  type: "chapter";
  title: string;
  children: LawNode[];
};

export type LawNode = LawArticle | LawSection | LawChapter;

/**
 * The complete law structure loaded from structure_.json
 */
export const lawStructure: LawChapter[] = structureData as LawChapter[];

/**
 * Searches through the law structure recursively
 * @param structure The structure to search through
 * @param query The search query (case-insensitive)
 * @returns Filtered structure containing only matching nodes
 */
export function searchStructure(
  structure: LawChapter[],
  query: string,
): LawChapter[] {
  if (!query || query.trim() === "") {
    return structure;
  }

  const normalizedQuery = query.toLowerCase().trim();

  const filterNode = (node: LawNode): LawNode | null => {
    // Check if current node matches
    const titleMatches = node.title.toLowerCase().includes(normalizedQuery);

    if (node.type === "article") {
      return titleMatches ? node : null;
    }

    if (node.type === "section" || node.type === "chapter") {
      // Recursively filter children
      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((child): child is LawNode => child !== null);

      // Include this node if it matches OR has matching children
      if (titleMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
    }

    return null;
  };

  return structure
    .map((chapter) => filterNode(chapter))
    .filter((chapter): chapter is LawChapter => chapter !== null);
}

/**
 * Counts the total number of articles in the structure
 * @param structure The structure to count articles from
 * @returns Total number of articles
 */
export function countArticles(structure: LawChapter[]): number {
  const countInNode = (node: LawNode): number => {
    if (node.type === "article") {
      return 1;
    }

    if (node.type === "section" || node.type === "chapter") {
      return node.children.reduce(
        (total, child) => total + countInNode(child),
        0,
      );
    }

    return 0;
  };

  return structure.reduce((total, chapter) => total + countInNode(chapter), 0);
}

/**
 * Finds a specific article by its number
 * @param structure The structure to search
 * @param articleNumber The article number to find (e.g., "1", "2", "10")
 * @returns The article if found, null otherwise
 */
export function findArticleByNumber(
  structure: LawChapter[],
  articleNumber: string,
): { article: LawArticle; path: string[] } | null {
  const searchInNode = (
    node: LawNode,
    path: string[],
  ): { article: LawArticle; path: string[] } | null => {
    if (node.type === "article") {
      // Extract article number from title (e.g., "Điều 1. ..." -> "1")
      const match = node.title.match(/Điều\s+(\d+)/);
      if (match && match[1] === articleNumber) {
        return { article: node, path };
      }
      return null;
    }

    if (node.type === "section" || node.type === "chapter") {
      for (const child of node.children) {
        const result = searchInNode(child, [...path, node.title]);
        if (result) {
          return result;
        }
      }
    }

    return null;
  };

  for (const chapter of structure) {
    const result = searchInNode(chapter, [chapter.title]);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Gets all articles as a flat list
 * @param structure The structure to extract articles from
 * @returns Array of all articles with their paths
 */
export function getAllArticles(
  structure: LawChapter[],
): Array<{ article: LawArticle; path: string[] }> {
  const articles: Array<{ article: LawArticle; path: string[] }> = [];

  const extractFromNode = (node: LawNode, path: string[]): void => {
    if (node.type === "article") {
      articles.push({ article: node, path });
      return;
    }

    if (node.type === "section" || node.type === "chapter") {
      const currentPath = [...path, node.title];
      node.children.forEach((child) => extractFromNode(child, currentPath));
    }
  };

  structure.forEach((chapter) => {
    extractFromNode(chapter, [chapter.title]);
  });

  return articles;
}

/**
 * Suggested questions about Vietnamese Land Law 2024
 */
const lawQuestions = [
  // General questions
  "Luật Đất đai 2024 có hiệu lực từ khi nào?",
  "Người sử dụng đất theo Luật Đất đai 2024 bao gồm những ai?",
  "Nguyên tắc sử dụng đất được quy định như thế nào?",

  // Land use rights
  "Quyền sử dụng đất của hộ gia đình được quy định như thế nào?",
  "Thời hạn sử dụng đất ở là bao lâu theo Luật Đất đai 2024?",
  "Điều kiện chuyển nhượng quyền sử dụng đất ở là gì?",

  // Procedures and certificates
  "Thủ tục cấp Giấy chứng nhận quyền sử dụng đất như thế nào?",
  "Thủ tục chuyển nhượng quyền sử dụng đất ở như thế nào?",
  "Đăng ký biến động đất đai được quy định ở điều nào?",

  // Land types
  "Phân loại đất được quy định như thế nào trong Luật Đất đai 2024?",
  "Đất nông nghiệp bao gồm những loại đất nào?",
  "Đất ở được phân thành những loại nào?",

  // Land recovery and compensation
  "Trường hợp nào Nhà nước được thu hồi đất?",
  "Nguyên tắc bồi thường khi Nhà nước thu hồi đất là gì?",
  "Ai được hỗ trợ tái định cư khi bị thu hồi đất?",

  // Land prices and finance
  "Điều 152 Luật Đất đai 2024 quy định gì về giá đất?",
  "Bảng giá đất được lập như thế nào?",
  "Các khoản thu từ đất đai bao gồm những gì?",

  // Land planning
  "Chương V của Luật Đất đai quy định về điều gì?",
  "Quy hoạch sử dụng đất cấp tỉnh được quy định như thế nào?",
  "Hệ thống quy hoạch sử dụng đất bao gồm những cấp nào?",

  // Specific articles
  "Điều 1 quy định về phạm vi điều chỉnh của Luật Đất đai 2024?",
  "Điều 3 giải thích những từ ngữ nào?",
  "Điều 260 có nội dung gì về quy định chuyển tiếp?",

  // Complex questions
  "So sánh quy định về chuyển nhượng đất ở và đất nông nghiệp",
  "Thủ tục đấu giá quyền sử dụng đất được quy định như thế nào?",
  "Quyền và nghĩa vụ của tổ chức kinh tế khi sử dụng đất?",

  // Disputes and complaints
  "Giải quyết tranh chấp đất đai được quy định ở chương nào?",
  "Quy trình giải quyết khiếu nại về đất đai như thế nào?",
  "Xử lý vi phạm pháp luật về đất đai được quy định ở đâu?",

  // Special cases
  "Người Việt Nam định cư ở nước ngoài có quyền sử dụng đất không?",
  "Tổ chức nước ngoài được sử dụng đất ở Việt Nam trong trường hợp nào?",
  "Hành vi bị nghiêm cấm trong lĩnh vực đất đai bao gồm những gì?",
];

/**
 * Gets random questions from the law questions pool
 * @param count Number of random questions to return (default: 4)
 * @returns Array of random question strings
 */
export function getRandomQuestions(count: number = 4): string[] {
  // Shuffle array using Fisher-Yates algorithm
  const shuffled = [...lawQuestions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return the requested number of questions
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
