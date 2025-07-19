import { useEffect, useState } from "react";
import { ChevronRight, List } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Parse HTML content to extract headings
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

    const items: TOCItem[] = [];
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent || "";
      const id = `heading-${index}`;

      // Add ID to heading for scrolling
      heading.id = id;

      items.push({
        id,
        text,
        level,
      });
    });

    setTocItems(items);
  }, [content]);

  useEffect(() => {
    // Update the actual DOM with IDs for scrolling
    const headings = document.querySelectorAll(
      ".article-content h1, .article-content h2, .article-content h3, .article-content h4, .article-content h5, .article-content h6, .article-content-dark h1, .article-content-dark h2, .article-content-dark h3, .article-content-dark h4, .article-content-dark h5, .article-content-dark h6"
    );
    headings.forEach((heading, index) => {
      heading.id = `heading-${index}`;
    });

    // Intersection Observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0% -35% 0%",
        threshold: 0,
      }
    );

    headings.forEach((heading) => {
      observer.observe(heading);
    });

    return () => {
      headings.forEach((heading) => {
        observer.unobserve(heading);
      });
    };
  }, [content]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setActiveId(id);
      setIsOpen(false); // Close mobile menu
    }
  };

  return (
    <>
      {/* Desktop TOC */}
      <div className="hidden lg:block sticky top-8 w-80 h-fit">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
            <List className="w-5 h-5 mr-2 text-primary" />
            Table of Contents
          </h3>
          <nav className="space-y-1">
            {tocItems.length === 0 ? (
              <div className="text-gray-500 text-sm py-2 px-3">No content</div>
            ) : (
              tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={`block w-full text-left text-sm py-2 px-3 rounded transition-all duration-200 ${
                    activeId === item.id
                      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  style={{
                    paddingLeft: `${(item.level - 1) * 16 + 12}px`,
                  }}
                >
                  <span className="block truncate">{item.text}</span>
                </button>
              ))
            )}
          </nav>
        </div>
      </div>

      {/* Mobile TOC */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <div className="relative">
          {isOpen && (
            <div className="absolute bottom-16 right-0 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center text-lg">
                <List className="w-5 h-5 mr-2 text-primary" />
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {tocItems.length === 0 ? (
                  <div className="text-gray-500 text-sm py-2 px-3">
                    No content
                  </div>
                ) : (
                  tocItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={`block w-full text-left text-sm py-2 px-3 rounded transition-all duration-200 ${
                        activeId === item.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                      style={{
                        paddingLeft: `${(item.level - 1) * 12 + 12}px`,
                      }}
                    >
                      <span className="block truncate">{item.text}</span>
                    </button>
                  ))
                )}
              </nav>
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-primary hover:bg-primary/90 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
