/**
 * Script to update structure_.json based on vectordb.json
 * This extracts the correct law structure from the official vectordb data
 */

const fs = require("fs");
const path = require("path");

// Load vectordb.json
const vectordbPath = path.join(__dirname, "../data/vectordb.json");
const outputPath = path.join(__dirname, "../data/structure_.json");

console.log("Reading vectordb.json...");
const vectordb = JSON.parse(fs.readFileSync(vectordbPath, "utf-8"));

// Extract all law items
const lawItems = vectordb.data.Get.LandLaw2024Vn;

console.log(`Found ${lawItems.length} law items`);

// Group by chapter, section, and article
const structureMap = new Map();

lawItems.forEach((item) => {
  const chapterId = item.chapter_id;
  const chapterTitle = item.chapter_title;
  const sectionId = item.section_id;
  const sectionTitle = item.section_title;
  const articleId = item.article_id;
  const articleTitle = item.title;

  // Skip if no chapter
  if (!chapterId || !chapterTitle) return;

  // Initialize chapter
  if (!structureMap.has(chapterId)) {
    structureMap.set(chapterId, {
      id: chapterId,
      title: `Chương ${chapterId}: ${chapterTitle}`,
      sections: new Map(),
      articles: [],
    });
  }

  const chapter = structureMap.get(chapterId);

  // If has section
  if (sectionId && sectionTitle) {
    if (!chapter.sections.has(sectionId)) {
      chapter.sections.set(sectionId, {
        id: sectionId,
        title: `Mục ${sectionId}: ${sectionTitle}`,
        articles: [],
      });
    }
    const section = chapter.sections.get(sectionId);

    // Add article to section
    if (articleId && articleTitle) {
      const articleExists = section.articles.some(
        (a) => a.title === articleTitle,
      );
      if (!articleExists) {
        section.articles.push({
          id: articleId,
          title: articleTitle,
        });
      }
    }
  } else {
    // Article directly under chapter (no section)
    if (articleId && articleTitle) {
      const articleExists = chapter.articles.some(
        (a) => a.title === articleTitle,
      );
      if (!articleExists) {
        chapter.articles.push({
          id: articleId,
          title: articleTitle,
        });
      }
    }
  }
});

// Convert to array and sort
const chapters = Array.from(structureMap.values()).sort((a, b) => {
  // Roman numeral to number for sorting
  const romanToInt = (roman) => {
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let result = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = map[roman[i]];
      const next = map[roman[i + 1]];
      if (next && current < next) {
        result -= current;
      } else {
        result += current;
      }
    }
    return result;
  };

  return romanToInt(a.id) - romanToInt(b.id);
});

// Build final structure
const finalStructure = chapters.map((chapter) => {
  const chapterNode = {
    type: "chapter",
    title: chapter.title,
    children: [],
  };

  // Add sections
  const sections = Array.from(chapter.sections.values()).sort(
    (a, b) => parseInt(a.id) - parseInt(b.id),
  );

  sections.forEach((section) => {
    const sectionNode = {
      type: "section",
      title: section.title,
      children: section.articles
        .sort((a, b) => parseInt(a.id) - parseInt(b.id))
        .map((article) => ({
          type: "article",
          title: article.title,
        })),
    };
    chapterNode.children.push(sectionNode);
  });

  // Add articles directly under chapter (no section)
  chapter.articles
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    .forEach((article) => {
      chapterNode.children.push({
        type: "article",
        title: article.title,
      });
    });

  return chapterNode;
});

// Write to file
console.log(`\nWriting structure to ${outputPath}...`);
fs.writeFileSync(outputPath, JSON.stringify(finalStructure, null, 2), "utf-8");

console.log("✅ Structure updated successfully!");
console.log(`Total chapters: ${finalStructure.length}`);

// Count articles
let totalArticles = 0;
let totalSections = 0;
finalStructure.forEach((chapter) => {
  chapter.children.forEach((child) => {
    if (child.type === "section") {
      totalSections++;
      totalArticles += child.children.length;
    } else if (child.type === "article") {
      totalArticles++;
    }
  });
});

console.log(`Total sections: ${totalSections}`);
console.log(`Total articles: ${totalArticles}`);
