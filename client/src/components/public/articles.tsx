import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  author: string;
  date: string;
  time: string;
}

export default function Articles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentArticleId, setCurrentArticleId] = useState<number | null>(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['/api/articles'],
    placeholderData: []
  });

  const searchArticles = (articles: Article[]) => {
    if (!searchQuery) return articles;
    return articles.filter(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredArticles = searchArticles(articles as Article[]);

  return (
    <section id="articles" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">Artikel Terbaru</h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
        </div>
        
        <div className="mb-8">
          <div className="relative max-w-lg mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" 
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" 
              placeholder="Cari artikel..."
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="animate-pulse space-y-8">
            <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg overflow-hidden shadow-md">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-6 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-8">
              {filteredArticles.map((article: Article) => (
                <div key={article.id} className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={article.image} 
                      alt={article.title} 
                      className="w-full h-full object-cover transform hover:scale-105 transition duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs text-gray-500">{`${article.date} · ${article.time}`}</span>
                      <span className="text-xs text-gray-500">{article.author}</span>
                    </div>
                    <h3 className="font-bold text-xl mb-2">{article.title}</h3>
                    <p className="text-gray-600 mb-4">{article.excerpt}</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => setCurrentArticleId(article.id)} 
                          variant="link" 
                          className="text-primary hover:text-[#1E40AF] p-0 h-auto font-medium"
                        >
                          Baca selengkapnya →
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-bold font-serif">{article.title}</DialogTitle>
                        </DialogHeader>
                        <div className="mb-4">
                          <img src={article.image} alt={article.title} className="w-full rounded-lg" />
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{article.author}</span>
                          </div>
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{`${article.date} · ${article.time}`}</span>
                          </div>
                        </div>
                        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: article.content }}></div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-10">
              <Button variant="outline" className="btn-secondary">
                Lihat Semua Artikel
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
